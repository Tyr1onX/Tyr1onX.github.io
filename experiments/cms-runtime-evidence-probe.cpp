#include <windows.h>
#include <tlhelp32.h>
#include <algorithm>
#include <cstdint>
#include <climits>
#include <cstring>
#include <iostream>
#include <set>
#include <string>
#include <vector>

struct Host{DWORD pid=0;};
static Host findHost(){Host o{};HANDLE ps=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0);if(ps==INVALID_HANDLE_VALUE)return o;PROCESSENTRY32W pe{};pe.dwSize=sizeof(pe);if(!Process32FirstW(ps,&pe)){CloseHandle(ps);return o;}do{if(_wcsicmp(pe.szExeFile,L"baidunetdiskhost.exe"))continue;HANDLE ms=CreateToolhelp32Snapshot(TH32CS_SNAPMODULE|TH32CS_SNAPMODULE32,pe.th32ProcessID);if(ms==INVALID_HANDLE_VALUE)continue;MODULEENTRY32W me{};me.dwSize=sizeof(me);if(Module32FirstW(ms,&me))do{if(!_wcsicmp(me.szModule,L"kernel.dll")){o.pid=pe.th32ProcessID;CloseHandle(ms);CloseHandle(ps);return o;}}while(Module32NextW(ms,&me));CloseHandle(ms);}while(Process32NextW(ps,&pe));CloseHandle(ps);return o;}
static long long field(const std::string&s,const std::string&k,long long def=-1){auto p=s.find(k);if(p==std::string::npos)return def;p+=k.size();bool neg=false;if(p<s.size()&&s[p]=='-'){neg=true;p++;}long long v=0;bool any=false;while(p<s.size()&&s[p]>='0'&&s[p]<='9'){any=true;v=v*10+(s[p]-'0');p++;}return any?(neg?-v:v):def;}
static std::string printableWindow(const std::vector<unsigned char>&b,size_t pos,size_t left=120,size_t right=900){size_t lo=pos>left?pos-left:0,hi=std::min(b.size(),pos+right);std::string s; s.reserve(hi-lo);for(size_t i=lo;i<hi;i++){unsigned char c=b[i];if(c>=32&&c<127)s.push_back((char)c);else s.push_back(' ');}return s;}
static void scanMarker(const std::vector<unsigned char>&b,const std::string&m,std::vector<size_t>&out){for(size_t off=0;;){auto it=std::search(b.begin()+off,b.end(),m.begin(),m.end());if(it==b.end())break;size_t p=(size_t)(it-b.begin());out.push_back(p);off=p+m.size();}}
int main(){Host host=findHost();if(!host.pid){std::cerr<<"host not found\n";return 2;}HANDLE h=OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_VM_READ,FALSE,host.pid);if(!h)return 3;SYSTEM_INFO si{};GetSystemInfo(&si);std::set<std::string> setslRows,downloadRows,typeRows,rawCmsRows;std::uint64_t regions=0,bytes=0,computedCms122880=0;
for(std::uintptr_t p=(std::uintptr_t)si.lpMinimumApplicationAddress;p<(std::uintptr_t)si.lpMaximumApplicationAddress;){MEMORY_BASIC_INFORMATION m{};if(!VirtualQueryEx(h,(LPCVOID)p,&m,sizeof(m)))break;auto st=(std::uintptr_t)m.BaseAddress;size_t sz=(size_t)m.RegionSize;bool ok=m.State==MEM_COMMIT&&(m.Type==MEM_PRIVATE||m.Type==MEM_MAPPED)&&!(m.Protect&PAGE_GUARD)&&!(m.Protect&PAGE_NOACCESS)&&sz<=64ull*1024*1024;if(ok){std::vector<unsigned char>b(sz);SIZE_T got=0;if(ReadProcessMemory(h,(LPCVOID)st,b.data(),sz,&got)){b.resize(got);regions++;bytes+=got;std::vector<size_t> pos;
scanMarker(b,"set sl|cdn_sl=",pos);for(auto q:pos){auto s=printableWindow(b,q,0,320);auto end=s.find("|",s.find("current_total_sl=")+17);if(end!=std::string::npos)s=s.substr(0,end+1);if(s.find("src=enable_cms_total_sl")!=std::string::npos)setslRows.insert(s);}
pos.clear();scanMarker(b,"download_common@#duration=",pos);for(auto q:pos){auto s=printableWindow(b,q,0,900);if(s.find("total_speed_limit=enable_cms_total_sl:")==std::string::npos)continue;long long dur=field(s,"duration="),flux=field(s,"download_flux="),avg=field(s,"average_speed="),total=field(s,"total_speed_limit=enable_cms_total_sl:"),cdn=field(s,"cdn_speed_limit=locatedownload:"),cur=field(s,"current_speed="),sample=field(s,"sample_avg_speed="),tasks=field(s,"current_task=");std::string row="duration="+std::to_string(dur)+" flux="+std::to_string(flux)+" avg="+std::to_string(avg)+" total="+std::to_string(total)+" cdn="+std::to_string(cdn)+" current="+std::to_string(cur)+" sample_avg="+std::to_string(sample)+" current_task="+std::to_string(tasks);downloadRows.insert(row);}
pos.clear();scanMarker(b,"total_limit_speed",pos);for(auto q:pos){auto s=printableWindow(b,q,180,320);if(s.find("total_limit_enable")!=std::string::npos&&s.find("81920")!=std::string::npos)rawCmsRows.insert(s);}
pos.clear();scanMarker(b,"total_limit_enable=0|total_max_speed=122880|",pos);computedCms122880+=pos.size();
pos.clear();scanMarker(b,"total_speed_type=enable_cms_total_sl@#total_speed_limit=",pos);for(auto q:pos){auto s=printableWindow(b,q,0,180);long long total=field(s,"total_speed_limit=");typeRows.insert("total="+std::to_string(total));}
}}
auto nx=st+sz;if(nx<=p)break;p=nx;}
std::cout<<"mode=read-only pid="<<host.pid<<" scanned_regions="<<regions<<" bytes="<<bytes<<"\n";
std::cout<<"CMS_RAW_81920_CONTEXTS="<<rawCmsRows.size()<<" CMS_COMPUTED_122880_HITS="<<computedCms122880<<"\n";
std::cout<<"SET_SL_UNIQUE="<<setslRows.size()<<"\n";for(const auto&s:setslRows)std::cout<<"SET_SL "<<s<<"\n";
std::cout<<"DOWNLOAD_COMMON_UNIQUE="<<downloadRows.size()<<"\n";for(const auto&s:downloadRows)std::cout<<"DOWNLOAD "<<s<<"\n";
long long n122=0,longN=0,longDur=0,longFlux=0,cdnHigherN=0,cdnHigherDur=0,cdnHigherFlux=0,shortBurstN=0,burstMin=LLONG_MAX,burstMax=0;
for(const auto&s:downloadRows){long long dur=field(s,"duration="),flux=field(s,"flux="),avg=field(s,"avg="),total=field(s,"total="),cdn=field(s,"cdn=");if(total==122880){n122++;if(dur>=100){longN++;longDur+=dur;longFlux+=flux;if(cdn>total){cdnHigherN++;cdnHigherDur+=dur;cdnHigherFlux+=flux;}}if(dur<=60&&avg>total*12/10){shortBurstN++;long long excess=(avg-total)*dur;burstMin=std::min(burstMin,excess);burstMax=std::max(burstMax,excess);}}}
std::cout<<"SUMMARY cms122_records="<<n122<<" long_ge100_records="<<longN<<" long_duration_s="<<longDur<<" long_flux="<<longFlux<<" long_weighted_Bps="<<(longDur?double(longFlux)/double(longDur):0.0)<<" cdn_gt_total_long_records="<<cdnHigherN<<" cdn_gt_total_duration_s="<<cdnHigherDur<<" cdn_gt_total_flux="<<cdnHigherFlux<<" cdn_gt_total_weighted_Bps="<<(cdnHigherDur?double(cdnHigherFlux)/double(cdnHigherDur):0.0)<<" short_burst_records="<<shortBurstN<<" short_burst_excess_min="<<(shortBurstN?burstMin:0)<<" short_burst_excess_max="<<burstMax<<"\n";
std::cout<<"TYPE_TOTAL_UNIQUE="<<typeRows.size()<<"\n";for(const auto&s:typeRows)std::cout<<"TYPE "<<s<<"\n";
CloseHandle(h);return 0;}
