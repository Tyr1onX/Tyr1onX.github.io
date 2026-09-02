#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
static uintptr_t GStop=0; static unsigned char GOrig=0; static uintptr_t GContinue=0; static bool GHit=false;
LONG WINAPI Veh(EXCEPTION_POINTERS*e){
  if(e->ExceptionRecord->ExceptionCode==EXCEPTION_BREAKPOINT && (uintptr_t)e->ExceptionRecord->ExceptionAddress==GStop){
    DWORD old=0; VirtualProtect((void*)GStop,1,PAGE_EXECUTE_READWRITE,&old); *(unsigned char*)GStop=GOrig; FlushInstructionCache(GetCurrentProcess(),(void*)GStop,1); DWORD tmp=0; VirtualProtect((void*)GStop,1,old,&tmp);
    GHit=true; e->ContextRecord->Rip=GContinue; return EXCEPTION_CONTINUE_EXECUTION;
  }
  std::cerr<<"EX code=0x"<<std::hex<<e->ExceptionRecord->ExceptionCode<<" rip=0x"<<e->ContextRecord->Rip<<std::dec<<"\n"; return EXCEPTION_CONTINUE_SEARCH;
}
static uint32_t u32(void*p,size_t o){uint32_t v;std::memcpy(&v,(unsigned char*)p+o,4);return v;}
int main(int argc,char**argv){
  if(argc<2)return 2; AddVectoredExceptionHandler(1,Veh); HMODULE m=LoadLibraryA(argv[1]); if(!m)return 3; auto b=(uintptr_t)m;
  using GetState=void*(__fastcall*)(); using Reset=void(__fastcall*)(void*); auto get=(GetState)(b+0xC2AA0); auto reset=(Reset)(b+0xEE960); auto state=(unsigned char*)get(); reset(state);
  int sl=120;
  unsigned char code[]={0x53,0x56,0x41,0x57,0x48,0x83,0xEC,0x20,0x49,0x89,0xD7,0x48,0x89,0xC8,0xFF,0xE0,0x48,0x83,0xC4,0x20,0x41,0x5F,0x5E,0x5B,0xC3};
  auto thunk=(unsigned char*)VirtualAlloc(nullptr,0x1000,MEM_COMMIT|MEM_RESERVE,PAGE_EXECUTE_READWRITE); if(!thunk)return 4; std::memcpy(thunk,code,sizeof(code)); FlushInstructionCache(GetCurrentProcess(),thunk,sizeof(code)); GContinue=(uintptr_t)(thunk+16);
  GStop=b+0x26D518; GOrig=*(unsigned char*)GStop; DWORD old=0; if(!VirtualProtect((void*)GStop,1,PAGE_EXECUTE_READWRITE,&old))return 5; *(unsigned char*)GStop=0xCC; FlushInstructionCache(GetCurrentProcess(),(void*)GStop,1); DWORD tmp=0; VirtualProtect((void*)GStop,1,old,&tmp);
  using Thunk=void(__fastcall*)(void*,int*); auto run=(Thunk)thunk; run((void*)(b+0x26D4D6),&sl);
  std::cout<<"breakpoint_hit="<<GHit<<" raw_sl="<<u32(state,0xAD8)
           <<" cdn_raw="<<u32(state,0x20)<<" cdn_src="<<u32(state,0x30)
           <<" total_raw="<<u32(state,0x90)<<" total_src="<<u32(state,0xA0)
           <<" locatedownload_active="<<(unsigned)state[0x1C1]<<"\n";
  return (GHit && u32(state,0xAD8)==120 && u32(state,0x20)==122880 && u32(state,0x90)==122880 && u32(state,0x30)==2 && u32(state,0xA0)==2)?0:6;
}
