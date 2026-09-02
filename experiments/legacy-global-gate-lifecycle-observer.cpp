#include <windows.h>
#include <tlhelp32.h>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <string>

struct HostInfo { DWORD pid=0; std::uintptr_t kernelBase=0; };
struct GateSnapshot { std::uint32_t effective=0; std::int64_t tokens=0; std::int64_t timestamp=0; std::uint32_t rawRate=0; std::uint32_t divisor=0; std::uint32_t source=0; };

static HostInfo findKernelHost(){
    HostInfo out{};
    HANDLE ps=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0);
    if(ps==INVALID_HANDLE_VALUE) return out;
    PROCESSENTRY32W pe{}; pe.dwSize=sizeof(pe);
    if(!Process32FirstW(ps,&pe)){ CloseHandle(ps); return out; }
    do{
        if(_wcsicmp(pe.szExeFile,L"baidunetdiskhost.exe")!=0) continue;
        HANDLE ms=CreateToolhelp32Snapshot(TH32CS_SNAPMODULE|TH32CS_SNAPMODULE32,pe.th32ProcessID);
        if(ms==INVALID_HANDLE_VALUE) continue;
        MODULEENTRY32W me{}; me.dwSize=sizeof(me);
        if(Module32FirstW(ms,&me)){
            do{
                if(_wcsicmp(me.szModule,L"kernel.dll")==0){
                    out.pid=pe.th32ProcessID;
                    out.kernelBase=reinterpret_cast<std::uintptr_t>(me.modBaseAddr);
                    CloseHandle(ms); CloseHandle(ps); return out;
                }
            }while(Module32NextW(ms,&me));
        }
        CloseHandle(ms);
    }while(Process32NextW(ps,&pe));
    CloseHandle(ps); return out;
}

template<class T> static bool readv(HANDLE h,std::uintptr_t addr,T& out){
    SIZE_T got=0; return ReadProcessMemory(h,reinterpret_cast<LPCVOID>(addr),&out,sizeof(out),&got)&&got==sizeof(out);
}

static bool readGate(HANDLE h,std::uintptr_t addr,std::size_t sourceOff,GateSnapshot& g){
    return readv(h,addr+0x08,g.effective) && readv(h,addr+0x10,g.tokens) &&
           readv(h,addr+0x18,g.timestamp) && readv(h,addr+0x20,g.rawRate) &&
           readv(h,addr+0x24,g.divisor) && readv(h,addr+sourceOff,g.source);
}

static void printGate(const char* name,const GateSnapshot& g){
    std::cout<<name
             <<" effective="<<g.effective
             <<" raw="<<g.rawRate
             <<" source="<<g.source
             <<" token="<<g.tokens
             <<" ts="<<g.timestamp
             <<" den="<<g.divisor;
}

int main(int argc,char**argv){
    const int intervalMs = argc>1 ? std::max(10,std::atoi(argv[1])) : 50;
    const int durationSec = argc>2 ? std::max(1,std::atoi(argv[2])) : 10;
    HostInfo host=findKernelHost();
    if(!host.kernelBase){ std::cerr<<"kernel host not found\n"; return 2; }
    HANDLE h=OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_VM_READ,FALSE,host.pid);
    if(!h){ std::cerr<<"OpenProcess failed="<<GetLastError()<<"\n"; return 3; }

    constexpr std::uintptr_t kGlobalPolicyRva=0x17C0118;
    const std::uintptr_t policy=host.kernelBase+kGlobalPolicyRva;
    const std::uintptr_t cdn=policy+0x00;
    const std::uintptr_t total=policy+0x70;
    std::uint32_t connectionCap=0, connectionPrimary=0, connectionSecondary=0, connectionMode=0;
    if(!readv(h,policy+0x760,connectionCap) || !readv(h,policy+0x748,connectionPrimary) ||
       !readv(h,policy+0x74C,connectionSecondary) || !readv(h,policy+0xD00,connectionMode)){
        std::cerr<<"failed to read connection policy fields\n"; CloseHandle(h); return 4;
    }

    std::cout<<"mode=read-only pid="<<host.pid
             <<" kernel_base=0x"<<std::hex<<host.kernelBase
             <<" policy=0x"<<policy<<std::dec
             <<" interval_ms="<<intervalMs
             <<" duration_s="<<durationSec
             <<" connection_cap="<<connectionCap
             <<" connection_primary="<<connectionPrimary
             <<" connection_secondary="<<connectionSecondary
             <<" connection_mode="<<connectionMode<<"\n";

    GateSnapshot prevC{},prevT{}; bool havePrev=false;
    std::uint64_t cdnTsChanges=0,totalTsChanges=0,cdnTokenChanges=0,totalTokenChanges=0,printed=0;
    IO_COUNTERS io0{}; GetProcessIoCounters(h,&io0);
    const ULONGLONG start=GetTickCount64();
    std::uint64_t samples=0, cdnZero=0,totalZero=0,bothLow=0;
    std::int64_t minC=INT64_MAX,maxC=INT64_MIN,minT=INT64_MAX,maxT=INT64_MIN;
    while(GetTickCount64()-start < static_cast<ULONGLONG>(durationSec)*1000ULL){
        GateSnapshot c{},t{};
        if(!readGate(h,cdn,0x30,c) || !readGate(h,total,0x30,t)){
            std::cerr<<"ReadProcessMemory failed at sample="<<samples<<"\n"; CloseHandle(h); return 4;
        }
        minC=std::min(minC,c.tokens); maxC=std::max(maxC,c.tokens);
        minT=std::min(minT,t.tokens); maxT=std::max(maxT,t.tokens);
        if(c.tokens<=0) ++cdnZero;
        if(t.tokens<=0) ++totalZero;
        if(c.tokens<4096 && t.tokens<4096) ++bothLow;
        const bool changed=!havePrev || c.effective!=prevC.effective || c.tokens!=prevC.tokens || c.timestamp!=prevC.timestamp || c.rawRate!=prevC.rawRate || c.source!=prevC.source || t.effective!=prevT.effective || t.tokens!=prevT.tokens || t.timestamp!=prevT.timestamp || t.rawRate!=prevT.rawRate || t.source!=prevT.source;
        if(havePrev){
            if(c.timestamp!=prevC.timestamp) ++cdnTsChanges;
            if(t.timestamp!=prevT.timestamp) ++totalTsChanges;
            if(c.tokens!=prevC.tokens) ++cdnTokenChanges;
            if(t.tokens!=prevT.tokens) ++totalTokenChanges;
        }
        if(changed && printed<40){
            std::cout<<"sample="<<samples<<" wall_ms="<<(GetTickCount64()-start)<<" ";
            printGate("CDN",c); std::cout<<" "; printGate("TOTAL",t); std::cout<<"\n";
            ++printed;
        }
        prevC=c; prevT=t; havePrev=true; ++samples; Sleep(intervalMs);
    }
    IO_COUNTERS io1{}; GetProcessIoCounters(h,&io1);
    std::cout<<"SUMMARY samples="<<samples
             <<" cdn_token_min="<<minC<<" cdn_token_max="<<maxC
             <<" total_token_min="<<minT<<" total_token_max="<<maxT
             <<" cdn_zero_samples="<<cdnZero
             <<" total_zero_samples="<<totalZero
             <<" both_lt4k_samples="<<bothLow
             <<" cdn_ts_changes="<<cdnTsChanges
             <<" total_ts_changes="<<totalTsChanges
             <<" cdn_token_changes="<<cdnTokenChanges
             <<" total_token_changes="<<totalTokenChanges
             <<" printed_changes="<<printed
             <<" read_bytes_delta="<<(io1.ReadTransferCount-io0.ReadTransferCount)
             <<" write_bytes_delta="<<(io1.WriteTransferCount-io0.WriteTransferCount)
             <<" other_bytes_delta="<<(io1.OtherTransferCount-io0.OtherTransferCount)
             <<"\n";
    CloseHandle(h); return 0;
}
