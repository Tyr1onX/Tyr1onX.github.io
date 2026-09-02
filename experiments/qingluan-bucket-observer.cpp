#include <windows.h>
#include <tlhelp32.h>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

static std::uintptr_t findKernelHost(DWORD& outPid) {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return 0;
    PROCESSENTRY32W pe{sizeof(pe)};
    if (!Process32FirstW(snap, &pe)) { CloseHandle(snap); return 0; }
    do {
        if (_wcsicmp(pe.szExeFile, L"baidunetdiskhost.exe") != 0) continue;
        HANDLE ms = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pe.th32ProcessID);
        if (ms == INVALID_HANDLE_VALUE) continue;
        MODULEENTRY32W me{sizeof(me)};
        if (Module32FirstW(ms, &me)) {
            do {
                if (_wcsicmp(me.szModule, L"kernel.dll") == 0) {
                    outPid = pe.th32ProcessID;
                    auto base = reinterpret_cast<std::uintptr_t>(me.modBaseAddr);
                    CloseHandle(ms); CloseHandle(snap); return base;
                }
            } while (Module32NextW(ms, &me));
        }
        CloseHandle(ms);
    } while (Process32NextW(snap, &pe));
    CloseHandle(snap); return 0;
}

template<class T>
static bool readVal(HANDLE h, std::uintptr_t p, T& out) {
    SIZE_T got=0; return ReadProcessMemory(h, reinterpret_cast<LPCVOID>(p), &out, sizeof(out), &got) && got==sizeof(out);
}

int main() {
    DWORD pid=0; const auto base=findKernelHost(pid);
    if (!base) { std::cerr << "kernel.dll host not found\n"; return 2; }
    HANDLE h=OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_VM_READ, FALSE, pid);
    if (!h) { std::cerr << "OpenProcess failed: " << GetLastError() << "\n"; return 3; }

    // kernel.dll 3.0.20.234, SHA-256 40EB35FC...C5D6
    // qingluan::common::AccumulateTokenBucket vtable RVA recovered by RTTI.
    const std::uintptr_t targetVtable = base + 0x13BD438;
    std::cout << "pid=" << pid << " kernel_base=0x" << std::hex << base
              << " vtable=0x" << targetVtable << std::dec << "\n";

    SYSTEM_INFO si{}; GetSystemInfo(&si);
    std::uintptr_t p=reinterpret_cast<std::uintptr_t>(si.lpMinimumApplicationAddress);
    const auto maxp=reinterpret_cast<std::uintptr_t>(si.lpMaximumApplicationAddress);
    std::size_t count=0;
    while (p<maxp) {
        MEMORY_BASIC_INFORMATION mbi{};
        if (!VirtualQueryEx(h, reinterpret_cast<LPCVOID>(p), &mbi, sizeof(mbi))) break;
        const auto start=reinterpret_cast<std::uintptr_t>(mbi.BaseAddress);
        const auto size=static_cast<std::size_t>(mbi.RegionSize);
        const bool readable=(mbi.State==MEM_COMMIT) && (mbi.Type==MEM_PRIVATE) && !(mbi.Protect&PAGE_GUARD) && !(mbi.Protect&PAGE_NOACCESS);
        if (readable && size<=64*1024*1024) {
            std::vector<unsigned char> buf(size); SIZE_T got=0;
            if (ReadProcessMemory(h,reinterpret_cast<LPCVOID>(start),buf.data(),size,&got)) {
                for (std::size_t i=0;i+8<=got;i+=8) {
                    std::uintptr_t v=0; memcpy(&v,buf.data()+i,8);
                    if (v!=targetVtable) continue;
                    const auto obj=start+i;
                    std::int64_t tokens=0,last=0; std::uint32_t rate=0, denom=0;
                    readVal(h,obj+0x10,tokens); readVal(h,obj+0x18,last);
                    readVal(h,obj+0x20,rate); readVal(h,obj+0x24,denom);
                    std::cout << "obj=0x" << std::hex << obj << std::dec
                              << " rate=" << rate << " B/s"
                              << " (" << std::fixed << std::setprecision(2) << rate/1024.0 << " KiB/s)"
                              << " token=" << tokens << " ts=" << last << " denom=" << denom << "\n";
                    ++count;
                }
            }
        }
        const auto next=start+size; if (next<=p) break; p=next;
    }
    std::cout << "count=" << count << "\n";
    CloseHandle(h); return 0;
}
