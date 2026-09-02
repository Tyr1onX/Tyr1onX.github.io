#include <windows.h>
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>

static double qpc_seconds() {
    static LARGE_INTEGER freq = [] { LARGE_INTEGER f{}; QueryPerformanceFrequency(&f); return f; }();
    LARGE_INTEGER now{};
    QueryPerformanceCounter(&now);
    return static_cast<double>(now.QuadPart) / static_cast<double>(freq.QuadPart);
}

int main(int argc, char** argv) {
    const double time_factor = argc > 1 ? std::max(0.01, std::atof(argv[1])) : 1.0;
    const double run_seconds = argc > 2 ? std::max(0.5, std::atof(argv[2])) : 4.0;
    const double rate = 120.0 * 1024.0;       // 120 KiB/s
    const double capacity = rate * 0.25;      // short burst allowance
    const std::uint64_t chunk = 4096;

    double tokens = 0.0;
    const double real_start = qpc_seconds();
    double last_real = real_start;
    std::uint64_t bytes = 0;

    while (true) {
        const double real_now = qpc_seconds();
        const double real_elapsed = real_now - real_start;
        if (real_elapsed >= run_seconds) break;

        const double real_dt = real_now - last_real;
        last_real = real_now;

        // This is what a time-hooked limiter effectively experiences:
        // perceived elapsed time grows faster than wall-clock time.
        const double perceived_dt = real_dt * time_factor;
        tokens = std::min(capacity, tokens + perceived_dt * rate);

        if (tokens >= static_cast<double>(chunk)) {
            tokens -= static_cast<double>(chunk);
            bytes += chunk;
        } else {
            Sleep(1);
        }
    }

    const double elapsed = qpc_seconds() - real_start;
    const double kib_per_s = static_cast<double>(bytes) / 1024.0 / elapsed;
    std::cout << std::fixed << std::setprecision(2)
              << "time_factor=" << time_factor
              << "  real_elapsed=" << elapsed << "s"
              << "  transferred=" << (static_cast<double>(bytes) / 1024.0) << " KiB"
              << "  throughput=" << kib_per_s << " KiB/s\n";
}
