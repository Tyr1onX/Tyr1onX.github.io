#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <string>
using MakeStreamFn=void*(__fastcall*)(void*,void*,int,int);using ParseTreeFn=void(__fastcall*)(void*,void*);using LookupFn=void*(__fastcall*)(void*,void*);using AllocFn=void*(__fastcall*)(size_t);using IntFn=int(__fastcall*)(void*,void*);using ConvObjFn=void*(__fastcall*)(unsigned char);
static void msstr(void*p,const char*s){auto*b=(unsigned char*)p;memset(b,0,32);size_t n=strlen(s);if(n<=15){memcpy(b,s,n+1);*(uint64_t*)(b+0x10)=n;*(uint64_t*)(b+0x18)=15;}else{char*q=(char*)HeapAlloc(GetProcessHeap(),0,n+1);memcpy(q,s,n+1);*(char**)b=q;*(uint64_t*)(b+0x10)=n;*(uint64_t*)(b+0x18)=n;}}static void pathobj(void*p,const char*k){auto*b=(unsigned char*)p;memset(b,0,48);msstr(b,k);b[0x20]='.';*(void**)(b+0x28)=(*(uint64_t*)(b+0x18)<=15)?(void*)b:*(void**)b;}static std::string readms(void*p){auto*b=(unsigned char*)p;auto n=*(uint64_t*)(b+0x10),c=*(uint64_t*)(b+0x18);const char*s=c<=15?(char*)b:*(char**)b;return s&&n<100?std::string(s,s+n):std::string();}
LONG WINAPI veh(EXCEPTION_POINTERS*e){auto*c=e->ContextRecord;std::cerr<<"EX 0x"<<std::hex<<e->ExceptionRecord->ExceptionCode<<" rip=0x"<<c->Rip<<" rcx=0x"<<c->Rcx<<" rdx=0x"<<c->Rdx<<std::dec<<"\n";return EXCEPTION_CONTINUE_SEARCH;}
int main(int argc,char**argv){AddVectoredExceptionHandler(1,veh);HMODULE m=LoadLibraryA(argv[1]);if(!m)return 2;auto b=(uintptr_t)m;auto alloc=(AllocFn)(b+0x112D314);auto mk=(MakeStreamFn)(b+0xC2AC0);auto parse=(ParseTreeFn)(b+0xC2C70);auto lookup=(LookupFn)(b+0x56C10);auto cv=(IntFn)(b+0x117590);auto convobj=(ConvObjFn)(b+0x112E0B0);
 alignas(16) unsigned char src[32],stream[0x120]{},tree[0x40]{},path[0x30]{},ctx[0x40]{};msstr(src,"{\"sl\":120,\"fsl\":-1}");*(uint64_t*)(tree+0x10)=0;*(uint64_t*)(tree+0x18)=15;auto holder=(unsigned char*)alloc(0x20);auto node=(unsigned char*)alloc(0x70);*(void**)(holder+8)=node;*(void**)(node+0x50)=node+0x48;*(void**)(node+0x58)=node+0x48;*(void**)(node+0x60)=node+0x60;*(void**)(node+0x68)=node+0x60;*(void**)(tree+0x20)=holder;mk(stream,src,3,1);parse(stream,tree);
 void*p=convobj(1);*(void**)(ctx+8)=p;std::cout<<"conv=0x"<<std::hex<<(uintptr_t)p<<std::dec<<"\n";if(!p)return 3;
 // Mirror the handler's post-allocation prepare sequence.
 auto vt=*(uintptr_t**)p;((void(__fastcall*)(void*))vt[1])(p);void*q=((void*(__fastcall*)(void*))vt[2])(p);if(q){auto qvt=*(uintptr_t**)q;((void(__fastcall*)(void*,int))qvt[0])(q,1);} 
 for(const char*k:{"sl","fsl"}){pathobj(path,k);void* child=lookup(tree,path);std::cout<<k<<" node="<<child<<" text='"<<(child?readms(child):"")<<"' ";if(!child)return 4;int v=cv(child,ctx);std::cout<<"value="<<v<<"\n";}return 0;}
