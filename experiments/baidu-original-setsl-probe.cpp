#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
using InitClockFn=void(__fastcall*)();
using GetStateFn=void*(__fastcall*)();
using ResetFn=void(__fastcall*)(void*);
using SetSlFn=void(__fastcall*)(void*,int32_t,int32_t,int32_t);
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}
static void dump(const char*tag,const unsigned char*s){
 std::cout<<tag
 <<" cdn_vptr=0x"<<std::hex<<u64(s,0x00)<<std::dec
 <<" cdn_eff="<<u32(s,0x08)<<" cdn_raw="<<u32(s,0x20)<<" cdn_src="<<u32(s,0x30)
 <<" total_vptr=0x"<<std::hex<<u64(s,0x70)<<std::dec
 <<" total_eff="<<u32(s,0x78)<<" total_raw="<<u32(s,0x90)<<" total_src="<<u32(s,0xA0)
 <<" ld_active="<<unsigned(s[0x1C1])<<"\n";
}
int main(int argc,char**argv){if(argc<2)return 2;HMODULE m=LoadLibraryA(argv[1]);if(!m)return 3;auto b=(uintptr_t)m;
 auto init=(InitClockFn)(b+0xE8200);auto getState=(GetStateFn)(b+0xC2AA0);auto reset=(ResetFn)(b+0xEE960);auto setsl=(SetSlFn)(b+0xEF110);
 init();auto*s=(unsigned char*)getState();dump("initial",s);reset(s);dump("after_reset",s);
 setsl(s,122880,122880,2);dump("after_locatedownload",s);
 setsl(s,-1,122880,1);dump("after_cms_total",s);
 setsl(s,999999,999999,4);dump("after_lower_priority_application",s);
 return 0;}
