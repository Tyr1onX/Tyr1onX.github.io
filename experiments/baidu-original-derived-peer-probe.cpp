#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
using InitClockFn=void(__fastcall*)();
using CtorFn=void*(__fastcall*)(void*,uint64_t,uint64_t,void*,uint64_t,uint64_t,uint64_t,void*,uint64_t,uint64_t,void*,void*);
using RateFn=void(__fastcall*)(void*,uint32_t);
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;} static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;} static void w64(unsigned char*p,size_t o,uint64_t v){std::memcpy(p+o,&v,8);}
LONG WINAPI Veh(EXCEPTION_POINTERS*e){auto*c=e->ContextRecord;std::cerr<<"EX 0x"<<std::hex<<e->ExceptionRecord->ExceptionCode<<" rip=0x"<<c->Rip<<" rcx=0x"<<c->Rcx<<" rdx=0x"<<c->Rdx<<std::dec<<"\n";return EXCEPTION_CONTINUE_SEARCH;}
static void emptystr(unsigned char*s){std::memset(s,0,32);w64(s,0x10,0);w64(s,0x18,15);}
int main(int argc,char**argv){AddVectoredExceptionHandler(1,Veh);if(argc<2)return 2;HMODULE m=LoadLibraryA(argv[1]);if(!m)return 3;auto b=(uintptr_t)m;auto init=(InitClockFn)(b+0xE8200);auto ctor=(CtorFn)(b+0x789B90);init();auto*p=(unsigned char*)VirtualAlloc(nullptr,0x1000,MEM_COMMIT|MEM_RESERVE,PAGE_READWRITE);unsigned char state16[16]{};unsigned char s8[0x98]{},s11[32],s12[32];emptystr(s8);emptystr(s8+0x20);emptystr(s8+0x40);emptystr(s8+0x60);emptystr(s11);emptystr(s12);std::cout<<"before ctor\n";std::cout.flush();ctor(p,0,0,state16,0,0,0,s8,0,0,s11,s12);std::cout<<"after vptr=0x"<<std::hex<<u64(p,0)<<std::dec<<" state1="<<u32(p,0x100)<<" state2="<<u32(p,0x128)<<" list488=0x"<<std::hex<<u64(p,0x488)<<std::dec<<" mode="<<u32(p,0x130)<<"\n";auto set1=(RateFn)(*(uint64_t*)(u64(p,0)+0x80));set1(p,122880);std::cout<<"after set1="<<u32(p,0x100)<<"\n";return 0;}


