#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
using InitClockFn=void(__fastcall*)();
using PeerCtorFn=void*(__fastcall*)(void*,uint32_t,uint32_t,uint32_t,uint32_t,void*,void*);
using RateFn=void(__fastcall*)(void*,uint32_t);
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}
static void dump(const char*tag,const unsigned char*p){std::cout<<tag<<" vptr=0x"<<std::hex<<u64(p,0)<<std::dec<<" state1_eff="<<u32(p,0xE8)<<" state1_raw="<<u32(p,0x100)<<" state2_eff="<<u32(p,0x110)<<" state2_raw="<<u32(p,0x128)<<" mode="<<u32(p,0x130)<<" arg2="<<u32(p,0x230)<<" arg4="<<u32(p,0x228)<<" arg5="<<u32(p,0x22C)<<" arg3="<<u32(p,0x244)<<" opaque298="<<u64(p,0x298)<<"\n";}
int main(int argc,char**argv){if(argc<2)return 2;HMODULE m=LoadLibraryA(argv[1]);if(!m){std::cerr<<GetLastError()<<"\n";return 3;}auto b=(uintptr_t)m;auto init=(InitClockFn)(b+0xE8200);auto ctor=(PeerCtorFn)(b+0xA330E0);init();alignas(16) unsigned char s16[16]{};alignas(16) unsigned char peer[0x300]{};ctor(peer,0,0,0,0,s16,nullptr);dump("after_ctor",peer);uint64_t vt=u64(peer,0);auto set1=(RateFn)(*(uint64_t*)(vt+0x80));auto set2=(RateFn)(*(uint64_t*)(vt+0x88));std::cout<<"slot80=0x"<<std::hex<<(uint64_t)(uintptr_t)set1<<" slot88=0x"<<(uint64_t)(uintptr_t)set2<<std::dec<<"\n";set1(peer,122880);set2(peer,32768);dump("after_set",peer);return 0;}
