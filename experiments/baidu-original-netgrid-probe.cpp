#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
using InitClockFn=void(__fastcall*)();
using NetGridCtorFn=void*(__fastcall*)(void*,void*);
using SetCdnFn=void(__fastcall*)(void*,uint32_t);
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}
static void dump(const char*tag,const unsigned char*n){
 std::cout<<tag
 <<" vptr=0x"<<std::hex<<u64(n,0)<<std::dec
 <<" up_rate="<<u32(n,0x30+0x20)
 <<" task_rate="<<u32(n,0x60+0x20)
 <<" cdn_rate="<<u32(n,0x90+0x20)
 <<" c0="<<u32(n,0xC0)<<" c4="<<u32(n,0xC4)<<" c8="<<u32(n,0xC8)<<" cc=0x"<<std::hex<<u32(n,0xCC)<<std::dec
 <<" d0="<<u32(n,0xD0)<<" d4="<<u32(n,0xD4)<<" d8="<<u32(n,0xD8)
 <<" owner="<<u64(n,0x240)<<" ctrl="<<u64(n,0x248)<<"\n";
}
int main(int argc,char**argv){if(argc<2)return 2;HMODULE m=LoadLibraryA(argv[1]);if(!m){std::cerr<<GetLastError()<<"\n";return 3;}auto b=(uintptr_t)m;auto init=(InitClockFn)(b+0xE8200);auto ctor=(NetGridCtorFn)(b+0x1A7E20);auto setcdn=(SetCdnFn)(b+0x1B7C20);init();alignas(16) unsigned char pair[16]{};alignas(16) unsigned char ng[0x2A8]{};ctor(ng,pair);dump("after_ctor",ng);setcdn(ng,16384);dump("after_set_16k",ng);setcdn(ng,32768);dump("after_set_32k",ng);return 0;}
