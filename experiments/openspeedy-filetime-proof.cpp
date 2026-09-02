#include <windows.h>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>

using SetSpeedFn = void(*)(double);
using GetSpeedFn = double(*)();
using IsEnabledFn = BOOL(*)();
using NtQuerySystemTimeFn = LONG (NTAPI*)(PLARGE_INTEGER);

static uint64_t real_nt_ms() {
    static auto fn = reinterpret_cast<NtQuerySystemTimeFn>(
        GetProcAddress(GetModuleHandleA("ntdll.dll"), "NtQuerySystemTime"));
    LARGE_INTEGER t{};
    if (!fn || fn(&t) != 0) return 0;
    return static_cast<uint64_t>(t.QuadPart) / 10000ULL;
}

static uint64_t filetime_ms() {
    FILETIME ft{};
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER u{};
    u.LowPart = ft.dwLowDateTime;
    u.HighPart = ft.dwHighDateTime;
    return u.QuadPart / 10000ULL;
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "usage: openspeedy-filetime-proof.exe <speedpatch64.dll> <factor> [bytes]\n";
        return 2;
    }

    const char* dllPath = argv[1];
    const double factor = std::strtod(argv[2], nullptr);
    const uint64_t target = argc >= 4
        ? std::strtoull(argv[3], nullptr, 10)
        : 3ULL * 1024ULL * 1024ULL;

    HMODULE mod = LoadLibraryA(dllPath);
    if (!mod) {
        std::cerr << "LoadLibrary failed: " << GetLastError() << "\n";
        return 3;
    }

    auto setSpeed = reinterpret_cast<SetSpeedFn>(GetProcAddress(mod, "SP_SetSpeed"));
    auto getSpeed = reinterpret_cast<GetSpeedFn>(GetProcAddress(mod, "SP_GetSpeed"));
    auto isEnabled = reinterpret_cast<IsEnabledFn>(GetProcAddress(mod, "SP_IsEnabled"));
    if (!setSpeed || !getSpeed || !isEnabled) {
        std::cerr << "required exports missing\n";
        return 4;
    }

    setSpeed(factor);

    constexpr uint64_t rate = 122880ULL;
    constexpr uint64_t capacity = 2115584ULL;
    constexpr uint64_t chunk = 4096ULL;

    uint64_t tokens = 0;
    uint64_t sent = 0;
    uint64_t last = filetime_ms();
    const uint64_t perceivedStart = last;
    const uint64_t realStart = real_nt_ms();

    while (sent < target) {
        const uint64_t now = filetime_ms();
        if (now > last) {
            const uint64_t elapsed = now - last;
            const uint64_t add = (elapsed * rate) / 1000ULL;
            tokens = (tokens + add > capacity) ? capacity : (tokens + add);
            last = now;
        }

        const uint64_t need = (target - sent < chunk) ? (target - sent) : chunk;
        if (tokens >= need) {
            tokens -= need;
            sent += need;
        } else {
            SwitchToThread();
        }
    }

    const uint64_t perceivedEnd = filetime_ms();
    const uint64_t realEnd = real_nt_ms();
    const uint64_t perceivedMs = perceivedEnd - perceivedStart;
    const uint64_t realMs = realEnd - realStart;

    std::cout << "enabled=" << (isEnabled() ? 1 : 0)
              << " requested_factor=" << std::fixed << std::setprecision(2) << factor
              << " exported_factor=" << getSpeed()
              << " bytes=" << target
              << " perceived_ms=" << perceivedMs
              << " real_nt_ms=" << realMs
              << " perceived_over_real=" << std::setprecision(3)
              << (realMs ? double(perceivedMs) / double(realMs) : 0.0)
              << " effective_real_kib_s=" << std::setprecision(2)
              << (realMs ? (double(target) / 1024.0) / (double(realMs) / 1000.0) : 0.0)
              << " final_tokens=" << tokens
              << "\n";
    return 0;
}
