#include <windows.h>
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>

static double qpc_seconds() {
    static LARGE_INTEGER freq = [] { LARGE_INTEGER f{}; QueryPerformanceFrequency(&f); return f; }();
    LARGE_INTEGER now{}; QueryPerformanceCounter(&now);
    return static_cast<double>(now.QuadPart) / static_cast<double>(freq.QuadPart);
}

struct Bucket {
    double rate{};
    double capacity{};
    double tokens{};
    void refill(double perceived_dt) {
        tokens = std::min(capacity, tokens + perceived_dt * rate);
    }
    bool take(std::uint64_t n) {
        if (tokens < static_cast<double>(n)) return false;
        tokens -= static_cast<double>(n); return true;
    }
};

int main(int argc, char** argv) {
    const int sl_kib = argc > 1 ? std::atoi(argv[1]) : 120;
    const double time_factor = argc > 2 ? std::atof(argv[2]) : 1.0;
    const double upstream_kib = argc > 3 ? std::atof(argv[3]) : 4096.0;
    const double run_seconds = argc > 4 ? std::atof(argv[4]) : 3.0;

    const double peer_default = 100.0 * 1024 * 1024;
    const double total_default = 500.0 * 1024 * 1024;
    const double sl_bps = sl_kib > 0 ? static_cast<double>(sl_kib) * 1024.0 : 0.0;

    // Recovered behavior model:
    // non-zero sl -> p2s peer/total and task token all receive sl*1024;
    // zero sl -> peer/total/task paths fall back to very loose defaults.
    Bucket peer { sl_bps > 0 ? sl_bps : peer_default,
                  sl_bps > 0 ? sl_bps : peer_default, 0 };
    Bucket total{ sl_bps > 0 ? sl_bps : total_default,
                  sl_bps > 0 ? sl_bps : total_default, 0 };
    Bucket task { sl_bps > 0 ? sl_bps : total_default,
                  sl_bps > 0 ? sl_bps : total_default, 0 };

    const std::uint64_t chunk = 4096;
    const double real_start = qpc_seconds();
    double last = real_start;
    double upstream_budget = 0.0;
    std::uint64_t bytes = 0;

    while (true) {
        const double now = qpc_seconds();
        if (now - real_start >= run_seconds) break;
        const double real_dt = now - last; last = now;
        const double perceived_dt = real_dt * time_factor;

        peer.refill(perceived_dt);
        total.refill(perceived_dt);
        task.refill(perceived_dt);

        upstream_budget = std::min(upstream_kib * 1024.0,
                                   upstream_budget + real_dt * upstream_kib * 1024.0);

        if (upstream_budget >= chunk && peer.tokens >= chunk && total.tokens >= chunk && task.tokens >= chunk) {
            upstream_budget -= chunk;
            peer.take(chunk); total.take(chunk); task.take(chunk);
            bytes += chunk;
        } else {
            Sleep(1);
        }
    }

    const double elapsed = qpc_seconds() - real_start;
    std::cout << std::fixed << std::setprecision(2)
              << "sl=" << sl_kib << " KiB/s"
              << " factor=" << time_factor
              << " upstream=" << upstream_kib << " KiB/s"
              << " throughput=" << (bytes / 1024.0 / elapsed) << " KiB/s\n";
}
