#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>
using InitClockFn=void(__fastcall*)();
using NetGridCtorFn=void*(__fastcall*)(void*,void*);
using RateFn=void(__fastcall*)(void*,uint32_t);
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}
static void w64(unsigned char*p,size_t o,uint64_t v){std::memcpy(p+o,&v,8);}
int main(int argc,char**argv){if(argc<2)return 2;HMODULE m=LoadLibraryA(argv[1]);if(!m)return 3;auto b=(uintptr_t)m;auto init=(InitClockFn)(b+0xE8200);auto ctor=(NetGridCtorFn)(b+0x1A7E20);init();alignas(16) unsigned char pair[16]{};alignas(16) unsigned char ng[0x2A8]{};ctor(ng,pair);alignas(16) unsigned char entity[0x120]{};uint64_t entityVtable=b+0x13500C8;w64(entity,0,entityVtable);w64(entity,0x108,(uint64_t)(uintptr_t)ng);auto slot=(RateFn)(*(uint64_t*)(entityVtable+0x50));std::cout<<"entity_vtable=0x"<<std::hex<<entityVtable<<" slot50=0x"<<(uint64_t)(uintptr_t)slot<<std::dec<<" initial_cdn="<<u32(ng,0xB0)<<"\n";slot(entity,16384);std::cout<<"after_entity_16k cdn_rate="<<u32(ng,0xB0)<<" cc=0x"<<std::hex<<u32(ng,0xCC)<<std::dec<<"\n";slot(entity,32768);std::cout<<"after_entity_32k cdn_rate="<<u32(ng,0xB0)<<"\n";return 0;}
