#include <windows.h>
#include <tlhelp32.h>

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <map>
#include <string>
#include <vector>

struct BucketSnapshot {
    std::uintptr_t address{};
    std::int64_t tokens{};
    std::int64_t timestamp{};
    std::uint32_t rate{};
    std::uint32_t denominator{};
};

static std::uintptr_t findKernelHost(DWORD& outPid) {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return 0;

    PROCESSENTRY32W pe{sizeof(pe)};
    if (!Process32FirstW(snap, &pe)) {
        CloseHandle(snap);
        return 0;
    }

    do {
        if (_wcsicmp(pe.szExeFile, L"baidunetdiskhost.exe") != 0) continue;

        HANDLE modules = CreateToolhelp32Snapshot(
            TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32,
            pe.th32ProcessID);
        if (modules == INVALID_HANDLE_VALUE) continue;

        MODULEENTRY32W me{sizeof(me)};
        if (Module32FirstW(modules, &me)) {
            do {
                if (_wcsicmp(me.szModule, L"kernel.dll") == 0) {
                    outPid = pe.th32ProcessID;
                    const auto base = reinterpret_cast<std::uintptr_t>(me.modBaseAddr);
                    CloseHandle(modules);
                    CloseHandle(snap);
                    return base;
                }
            } while (Module32NextW(modules, &me));
        }
        CloseHandle(modules);
    } while (Process32NextW(snap, &pe));

    CloseHandle(snap);
    return 0;
}

template<class T>
static bool readVal(HANDLE process, std::uintptr_t address, T& out) {
    SIZE_T got = 0;
    return ReadProcessMemory(
               process,
               reinterpret_cast<LPCVOID>(address),
               &out,
               sizeof(out),
               &got) &&
           got == sizeof(out);
}

static std::vector<BucketSnapshot> scanBuckets(
    HANDLE process,
    std::uintptr_t targetVtable) {

    SYSTEM_INFO si{};
    GetSystemInfo(&si);

    std::vector<BucketSnapshot> result;
    std::uintptr_t cursor = reinterpret_cast<std::uintptr_t>(si.lpMinimumApplicationAddress);
    const auto maxAddress = reinterpret_cast<std::uintptr_t>(si.lpMaximumApplicationAddress);

    while (cursor < maxAddress) {
        MEMORY_BASIC_INFORMATION mbi{};
        if (!VirtualQueryEx(
                process,
                reinterpret_cast<LPCVOID>(cursor),
                &mbi,
                sizeof(mbi))) {
            break;
        }

        const auto start = reinterpret_cast<std::uintptr_t>(mbi.BaseAddress);
        const auto size = static_cast<std::size_t>(mbi.RegionSize);
        const bool readable =
            mbi.State == MEM_COMMIT &&
            mbi.Type == MEM_PRIVATE &&
            !(mbi.Protect & PAGE_GUARD) &&
            !(mbi.Protect & PAGE_NOACCESS);

        // Keep the observer bounded and read-only.
        if (readable && size <= 64 * 1024 * 1024) {
            std::vector<unsigned char> buffer(size);
            SIZE_T got = 0;
            if (ReadProcessMemory(
                    process,
                    reinterpret_cast<LPCVOID>(start),
                    buffer.data(),
                    size,
                    &got)) {

                for (std::size_t i = 0; i + sizeof(std::uintptr_t) <= got; i += 8) {
                    std::uintptr_t candidateVtable = 0;
                    std::memcpy(&candidateVtable, buffer.data() + i, sizeof(candidateVtable));
                    if (candidateVtable != targetVtable) continue;

                    BucketSnapshot s{};
                    s.address = start + i;
                    if (!readVal(process, s.address + 0x10, s.tokens)) continue;
                    if (!readVal(process, s.address + 0x18, s.timestamp)) continue;
                    if (!readVal(process, s.address + 0x20, s.rate)) continue;
                    if (!readVal(process, s.address + 0x24, s.denominator)) continue;
                    result.push_back(s);
                }
            }
        }

        const auto next = start + size;
        if (next <= cursor) break;
        cursor = next;
    }

    return result;
}

static bool changed(const BucketSnapshot& a, const BucketSnapshot& b) {
    return a.tokens != b.tokens ||
           a.timestamp != b.timestamp ||
           a.rate != b.rate ||
           a.denominator != b.denominator;
}

static void printSnapshot(
    const char* event,
    std::uint64_t sample,
    const BucketSnapshot& s) {

    std::cout
        << "sample=" << sample
        << " event=" << event
        << " obj=0x" << std::hex << s.address << std::dec
        << " rate=" << s.rate << " B/s"
        << " rate_kib=" << std::fixed << std::setprecision(2)
        << (static_cast<double>(s.rate) / 1024.0)
        << " token=" << s.tokens
        << " ts=" << s.timestamp
        << " denom=" << s.denominator
        << "\n";
}

int main(int argc, char** argv) {
    const unsigned intervalMs = argc > 1
        ? static_cast<unsigned>(std::strtoul(argv[1], nullptr, 10))
        : 500;
    const unsigned durationSeconds = argc > 2
        ? static_cast<unsigned>(std::strtoul(argv[2], nullptr, 10))
        : 20;

    DWORD pid = 0;
    const auto kernelBase = findKernelHost(pid);
    if (!kernelBase) {
        std::cerr << "kernel.dll host not found\n";
        return 2;
    }

    HANDLE process = OpenProcess(
        PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
        FALSE,
        pid);
    if (!process) {
        std::cerr << "OpenProcess failed: " << GetLastError() << "\n";
        return 3;
    }

    // Recovered for kernel.dll 3.0.20.234, SHA-256 prefix 40EB35FC.
    // qingluan::common::AccumulateTokenBucket vtable RVA.
    const std::uintptr_t targetVtable = kernelBase + 0x13BD438;

    std::cout
        << "mode=read-only"
        << " pid=" << pid
        << " kernel_base=0x" << std::hex << kernelBase
        << " target_vtable=0x" << targetVtable << std::dec
        << " interval_ms=" << intervalMs
        << " duration_s=" << durationSeconds
        << "\n";

    std::map<std::uintptr_t, BucketSnapshot> previous;
    const std::uint64_t samples = intervalMs == 0
        ? 1
        : (static_cast<std::uint64_t>(durationSeconds) * 1000ULL) / intervalMs + 1ULL;

    for (std::uint64_t sample = 0; sample < samples; ++sample) {
        const auto currentList = scanBuckets(process, targetVtable);
        std::map<std::uintptr_t, BucketSnapshot> current;
        for (const auto& item : currentList) current[item.address] = item;

        for (const auto& [address, item] : current) {
            const auto it = previous.find(address);
            if (it == previous.end()) {
                printSnapshot("appear", sample, item);
            } else if (changed(it->second, item)) {
                printSnapshot("change", sample, item);
            }
        }

        for (const auto& [address, item] : previous) {
            if (current.find(address) == current.end()) {
                printSnapshot("disappear", sample, item);
            }
        }

        std::cout
            << "sample=" << sample
            << " event=summary"
            << " bucket_count=" << current.size()
            << "\n";
        std::cout.flush();

        previous = std::move(current);
        if (sample + 1 < samples && intervalMs != 0) Sleep(intervalMs);
    }

    CloseHandle(process);
    return 0;
}
