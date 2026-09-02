#include <windows.h>
#include <tlhelp32.h>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <map>
#include <string>
#include <vector>

struct Kind { const char* name; std::uintptr_t rva; };
static const Kind kinds[] = {
  {"legacy.TokenBucket", 0x133E1C8},
  {"legacy.AccumulateTokenBucket", 0x133E1F8},
  {"qingluan.TokenBucket", 0x13BD408},
  {"qingluan.AccumulateTokenBucket", 0x13BD438},
};

static std::uintptr_t findKernelHost(DWORD& outPid) {
  HANDLE s=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0); if(s==INVALID_HANDLE_VALUE)return 0;
  PROCESSENTRY32W pe{sizeof(pe)}; if(!Process32FirstW(s,&pe)){CloseHandle(s);return 0;}
  do { if(_wcsicmp(pe.szExeFile,L"baidunetdiskhost.exe"))continue;
    HANDLE m=CreateToolhelp32Snapshot(TH32CS_SNAPMODULE|TH32CS_SNAPMODULE32,pe.th32ProcessID); if(m==INVALID_HANDLE_VALUE)continue;
    MODULEENTRY32W me{sizeof(me)}; if(Module32FirstW(m,&me)) do { if(!_wcsicmp(me.szModule,L"kernel.dll")){outPid=pe.th32ProcessID;auto b=(std::uintptr_t)me.modBaseAddr;CloseHandle(m);CloseHandle(s);return b;} } while(Module32NextW(m,&me)); CloseHandle(m);
  } while(Process32NextW(s,&pe)); CloseHandle(s); return 0;
}

template<class T> static bool rv(HANDLE h,std::uintptr_t p,T& v){SIZE_T n=0;return ReadProcessMemory(h,(LPCVOID)p,&v,sizeof(v),&n)&&n==sizeof(v);}

int main(){DWORD pid=0;auto base=findKernelHost(pid);if(!base){std::cerr<<"kernel host not found\n";return 2;}HANDLE h=OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_VM_READ,FALSE,pid);if(!h)return 3;
  std::map<std::uintptr_t,std::string> vt; for(auto& k:kinds)vt[base+k.rva]=k.name;
  std::map<std::string,int> counts; std::cout<<"pid="<<pid<<" base=0x"<<std::hex<<base<<std::dec<<"\n";
  SYSTEM_INFO si{};GetSystemInfo(&si);auto p=(std::uintptr_t)si.lpMinimumApplicationAddress,maxp=(std::uintptr_t)si.lpMaximumApplicationAddress;
  while(p<maxp){MEMORY_BASIC_INFORMATION mbi{};if(!VirtualQueryEx(h,(LPCVOID)p,&mbi,sizeof(mbi)))break;auto st=(std::uintptr_t)mbi.BaseAddress;size_t sz=(size_t)mbi.RegionSize;
    bool ok=mbi.State==MEM_COMMIT&&mbi.Type==MEM_PRIVATE&&!(mbi.Protect&PAGE_GUARD)&&!(mbi.Protect&PAGE_NOACCESS)&&sz<=64ull*1024*1024;
    if(ok){std::vector<unsigned char>b(sz);SIZE_T got=0;if(ReadProcessMemory(h,(LPCVOID)st,b.data(),sz,&got)){for(size_t i=0;i+8<=got;i+=8){std::uintptr_t v=0;memcpy(&v,b.data()+i,8);auto it=vt.find(v);if(it==vt.end())continue;auto o=st+i;std::int64_t tok=0,last=0;std::uint32_t rate=0,den=0,cap=0;rv(h,o+0x08,cap);rv(h,o+0x10,tok);rv(h,o+0x18,last);rv(h,o+0x20,rate);rv(h,o+0x24,den);counts[it->second]++;std::cout<<it->second<<" obj=0x"<<std::hex<<o<<std::dec<<" cap="<<cap<<" rate="<<rate<<" ("<<std::fixed<<std::setprecision(2)<<rate/1024.0<<" KiB/s) token="<<tok<<" ts="<<last<<" den="<<den<<"\n";}}}
    auto nx=st+sz;if(nx<=p)break;p=nx;}
  std::cout<<"COUNTS";for(auto& k:kinds)std::cout<<" "<<k.name<<"="<<counts[k.name];std::cout<<"\n";CloseHandle(h);
}
