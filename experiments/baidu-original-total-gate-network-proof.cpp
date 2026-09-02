#include <winsock2.h>
#include <windows.h>
#include <ws2tcpip.h>
#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <thread>
#include <vector>


using InitClockFn=void(__fastcall*)();
using GetStateFn=void*(__fastcall*)();
using ResetFn=void(__fastcall*)(void*);
using SetSlFn=void(__fastcall*)(void*,int32_t,int32_t,int32_t);
using RefillFn=void(__fastcall*)(void*);
using ConsumeFn=uint32_t(__fastcall*)(void*,uint32_t);
using TimeFn=uint64_t(__fastcall*)();
using SetSpeedFn=void(*)(double);
using GetSpeedFn=double(*)();
using IsEnabledFn=BOOL(*)();
using NtQuerySystemTimeFn=LONG (NTAPI*)(PLARGE_INTEGER);

static uint64_t real_nt_ms(){
    static auto fn=(NtQuerySystemTimeFn)GetProcAddress(GetModuleHandleA("ntdll.dll"),"NtQuerySystemTime");
    LARGE_INTEGER t{};
    if(!fn||fn(&t)!=0)return 0;
    return uint64_t(t.QuadPart)/10000ULL;
}
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}
static uint64_t fnv1a(uint64_t h,const unsigned char* p,size_t n){
    for(size_t i=0;i<n;++i){h^=p[i];h*=1099511628211ULL;} return h;
}

struct ServerResult{uint64_t bytes=0; uint64_t start_ms=0; uint64_t end_ms=0; int err=0;};

int main(int argc,char**argv){
    if(argc<4)return 2;
    const double factor=std::strtod(argv[3],nullptr);
    const uint64_t target=argc>=5?std::strtoull(argv[4],nullptr,10):3ULL*1024ULL*1024ULL;
    const uint64_t liveResidual=argc>=6?std::strtoull(argv[5],nullptr,10):18ULL;
    const int32_t rateBps=argc>=7?std::strtol(argv[6],nullptr,10):122880;

    WSADATA w{}; if(WSAStartup(MAKEWORD(2,2),&w)!=0)return 20;
    SOCKET listener=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP); if(listener==INVALID_SOCKET)return 21;
    int buf=16*1024; setsockopt(listener,SOL_SOCKET,SO_SNDBUF,(char*)&buf,sizeof(buf));
    sockaddr_in a{}; a.sin_family=AF_INET; a.sin_addr.s_addr=htonl(INADDR_LOOPBACK); a.sin_port=0;
    if(bind(listener,(sockaddr*)&a,sizeof(a))!=0)return 22;
    if(listen(listener,1)!=0)return 23;
    int alen=sizeof(a); if(getsockname(listener,(sockaddr*)&a,&alen)!=0)return 24;
    const uint16_t port=ntohs(a.sin_port);

    ServerResult sr{}; std::atomic<bool> ready{false};
    std::thread server([&]{
        ready.store(true,std::memory_order_release);
        SOCKET c=accept(listener,nullptr,nullptr); if(c==INVALID_SOCKET){sr.err=WSAGetLastError();return;}
        setsockopt(c,SOL_SOCKET,SO_SNDBUF,(char*)&buf,sizeof(buf));
        std::vector<unsigned char> block(4096);
        for(size_t i=0;i<block.size();++i)block[i]=(unsigned char)((i*131u+17u)&0xffu);
        sr.start_ms=real_nt_ms();
        while(sr.bytes<target){
            const int want=(int)std::min<uint64_t>(block.size(),target-sr.bytes);
            int n=send(c,(const char*)block.data(),want,0);
            if(n<=0){sr.err=WSAGetLastError();break;}
            sr.bytes+=(uint64_t)n;
        }
        shutdown(c,SD_SEND); closesocket(c); sr.end_ms=real_nt_ms();
    });
    while(!ready.load(std::memory_order_acquire))SwitchToThread();

    HMODULE k=LoadLibraryA(argv[1]); if(!k)return 3;
    const auto b=(uintptr_t)k;
    auto init=(InitClockFn)(b+0xE8200); auto getState=(GetStateFn)(b+0xC2AA0);
    auto reset=(ResetFn)(b+0xEE960); auto setsl=(SetSlFn)(b+0xEF110);
    auto refill=(RefillFn)(b+0xE83F0); auto consume=(ConsumeFn)(b+0xE8220); auto nowk=(TimeFn)(b+0xDDAD0);
    init(); auto*s=(unsigned char*)getState(); reset(s); setsl(s,rateBps,rateBps,2); setsl(s,-1,rateBps,1);
    auto*total=s+0x70; refill(total);

    HMODULE sp=nullptr; SetSpeedFn setSpeed=nullptr; GetSpeedFn getSpeed=nullptr; IsEnabledFn isEnabled=nullptr;
    const bool useHook=std::strcmp(argv[2],"-")!=0;
    if(useHook){
        sp=LoadLibraryA(argv[2]); if(!sp)return 4;
        setSpeed=(SetSpeedFn)GetProcAddress(sp,"SP_SetSpeed");
        getSpeed=(GetSpeedFn)GetProcAddress(sp,"SP_GetSpeed");
        isEnabled=(IsEnabledFn)GetProcAddress(sp,"SP_IsEnabled");
        if(!setSpeed||!getSpeed||!isEnabled)return 5;
        setSpeed(factor);
    }

    for(;;){
        const uint64_t token=u64(total,0x10); if(token<=liveResidual)break;
        const uint32_t amount=(uint32_t)std::min<uint64_t>(token-liveResidual,0x10000ULL);
        if(!amount||consume(total,amount)!=amount)break;
    }
    const uint64_t seed=u64(total,0x10);

    SOCKET c=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP); if(c==INVALID_SOCKET)return 25;
    setsockopt(c,SOL_SOCKET,SO_RCVBUF,(char*)&buf,sizeof(buf));
    sockaddr_in dst{}; dst.sin_family=AF_INET; dst.sin_addr.s_addr=htonl(INADDR_LOOPBACK); dst.sin_port=htons(port);
    if(connect(c,(sockaddr*)&dst,sizeof(dst))!=0)return 26;

    char tmpDir[MAX_PATH]{},tmpFile[MAX_PATH]{}; GetTempPathA(MAX_PATH,tmpDir); GetTempFileNameA(tmpDir,"bdg",0,tmpFile);
    HANDLE fh=CreateFileA(tmpFile,GENERIC_WRITE,0,nullptr,CREATE_ALWAYS,FILE_ATTRIBUTE_TEMPORARY,nullptr); if(fh==INVALID_HANDLE_VALUE)return 27;

    std::vector<unsigned char> block(4096); uint64_t got=0,hash=1469598103934665603ULL;
    const uint64_t k0=nowk(),r0=real_nt_ms();
    while(got<target){
        refill(total);
        const uint32_t want=(uint32_t)std::min<uint64_t>(block.size(),target-got);
        if(u64(total,0x10)<want){SwitchToThread();continue;}
        if(consume(total,want)!=want)continue;
        uint32_t have=0;
        while(have<want){
            int n=recv(c,(char*)block.data()+have,(int)(want-have),0); if(n<=0){CloseHandle(fh);return 28;} have+=(uint32_t)n;
        }
        DWORD wr=0; if(!WriteFile(fh,block.data(),have,&wr,nullptr)||wr!=have){CloseHandle(fh);return 29;}
        hash=fnv1a(hash,block.data(),have); got+=have;
    }
    FlushFileBuffers(fh); const uint64_t r1=real_nt_ms(),k1=nowk(); CloseHandle(fh); DeleteFileA(tmpFile);
    shutdown(c,SD_BOTH); closesocket(c); closesocket(listener); server.join(); WSACleanup();

    const uint64_t rm=r1-r0,km=k1-k0,sm=(sr.end_ms>=sr.start_ms?sr.end_ms-sr.start_ms:0);
    std::cout<<"enabled="<<(useHook && isEnabled && isEnabled()?1:0)
      <<" factor="<<std::fixed<<std::setprecision(2)<<(useHook && getSpeed?getSpeed():1.0)
      <<" bytes="<<got<<" server_bytes="<<sr.bytes<<" rate_bps="<<rateBps<<" seed_token="<<seed
      <<" kernel_elapsed_ms="<<km<<" real_nt_ms="<<rm<<" server_real_ms="<<sm
      <<" kernel_over_real="<<std::setprecision(3)<<(rm?double(km)/rm:0.0)
      <<" effective_real_kib_s="<<std::setprecision(2)<<(rm?(double(got)/1024.0)/(double(rm)/1000.0):0.0)
      <<" hash=0x"<<std::hex<<hash<<std::dec
      <<" cdn_raw="<<u32(s,0x20)<<" cdn_src="<<u32(s,0x30)<<" total_raw="<<u32(s,0x90)<<" total_src="<<u32(s,0xA0)
      <<" total_tokens="<<u64(total,0x10)<<" server_err="<<sr.err<<"\n";
    return 0;
}
