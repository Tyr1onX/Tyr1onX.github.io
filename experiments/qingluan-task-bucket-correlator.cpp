#include <windows.h>
#include <tlhelp32.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <vector>

struct HostInfo {
    DWORD pid{};
    std::uintptr_t kernelBase{};
    std::size_t kernelSize{};
    std::wstring kernelPath;
};

struct Region {
    std::uintptr_t base{};
    std::size_t size{};
    DWORD type{};
    DWORD protect{};
    std::vector<unsigned char> bytes;
};

struct Bucket {
    std::uintptr_t address{};
    std::int64_t tokens{};
    std::int64_t timestamp{};
    std::uint32_t rate{};
    std::uint32_t denominator{};
};

static bool findKernelHost(HostInfo& out) {
    HANDLE ps = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (ps == INVALID_HANDLE_VALUE) return false;
    PROCESSENTRY32W pe{};
    pe.dwSize = sizeof(pe);
    if (!Process32FirstW(ps, &pe)) {
        CloseHandle(ps);
        return false;
    }
    do {
        if (_wcsicmp(pe.szExeFile, L"baidunetdiskhost.exe") != 0) continue;
        HANDLE ms = CreateToolhelp32Snapshot(
            TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pe.th32ProcessID);
        if (ms == INVALID_HANDLE_VALUE) continue;
        MODULEENTRY32W me{};
        me.dwSize = sizeof(me);
        if (Module32FirstW(ms, &me)) {
            do {
                if (_wcsicmp(me.szModule, L"kernel.dll") == 0) {
                    out.pid = pe.th32ProcessID;
                    out.kernelBase = reinterpret_cast<std::uintptr_t>(me.modBaseAddr);
                    out.kernelSize = static_cast<std::size_t>(me.modBaseSize);
                    out.kernelPath = me.szExePath;
                    CloseHandle(ms);
                    CloseHandle(ps);
                    return true;
                }
            } while (Module32NextW(ms, &me));
        }
        CloseHandle(ms);
    } while (Process32NextW(ps, &pe));
    CloseHandle(ps);
    return false;
}

template<class T>
static bool readVal(HANDLE process, std::uintptr_t address, T& out) {
    SIZE_T got = 0;
    return ReadProcessMemory(process, reinterpret_cast<LPCVOID>(address),
                             &out, sizeof(out), &got) && got == sizeof(out);
}

static bool plausibleReadable(const MEMORY_BASIC_INFORMATION& mbi) {
    if (mbi.State != MEM_COMMIT) return false;
    if (mbi.Protect & PAGE_GUARD) return false;
    if (mbi.Protect & PAGE_NOACCESS) return false;
    return true;
}

static std::vector<Region> snapshotReadablePrivate(HANDLE process) {
    SYSTEM_INFO si{};
    GetSystemInfo(&si);
    std::vector<Region> out;
    std::uintptr_t cursor = reinterpret_cast<std::uintptr_t>(si.lpMinimumApplicationAddress);
    const auto maxAddress = reinterpret_cast<std::uintptr_t>(si.lpMaximumApplicationAddress);
    while (cursor < maxAddress) {
        MEMORY_BASIC_INFORMATION mbi{};
        if (!VirtualQueryEx(process, reinterpret_cast<LPCVOID>(cursor), &mbi, sizeof(mbi))) break;
        const auto base = reinterpret_cast<std::uintptr_t>(mbi.BaseAddress);
        const auto size = static_cast<std::size_t>(mbi.RegionSize);
        if (plausibleReadable(mbi) && mbi.Type == MEM_PRIVATE && size <= 64 * 1024 * 1024) {
            Region r{};
            r.base = base;
            r.size = size;
            r.type = mbi.Type;
            r.protect = mbi.Protect;
            r.bytes.resize(size);
            SIZE_T got = 0;
            if (ReadProcessMemory(process, reinterpret_cast<LPCVOID>(base),
                                  r.bytes.data(), size, &got) && got > 0) {
                r.bytes.resize(static_cast<std::size_t>(got));
                out.push_back(std::move(r));
            }
        }
        const auto next = base + size;
        if (next <= cursor) break;
        cursor = next;
    }
    return out;
}

static std::string hex16(const std::array<unsigned char, 16>& b) {
    std::ostringstream os;
    for (auto v : b) os << std::hex << std::setw(2) << std::setfill('0') << (unsigned)v;
    return os.str();
}

static std::string ascii16(const std::array<unsigned char, 16>& b) {
    std::string s;
    for (auto v : b) s.push_back(std::isprint(v) ? static_cast<char>(v) : '.');
    return s;
}

static bool inKernel(std::uintptr_t p, const HostInfo& h) {
    return p >= h.kernelBase && p < h.kernelBase + h.kernelSize;
}

static std::string rttiNameForVtable(HANDLE process, const HostInfo& host, std::uintptr_t vt) {
    if (!inKernel(vt, host) || vt < 8) return {};
    std::uintptr_t col = 0;
    if (!readVal(process, vt - 8, col) || !inKernel(col, host)) return {};
    std::uint32_t typeRva = 0;
    if (!readVal(process, col + 12, typeRva)) return {};
    const auto td = host.kernelBase + static_cast<std::uintptr_t>(typeRva);
    if (!inKernel(td, host)) return {};
    char name[256]{};
    SIZE_T got = 0;
    if (!ReadProcessMemory(process, reinterpret_cast<LPCVOID>(td + 16), name, sizeof(name) - 1, &got) || got == 0) return {};
    name[sizeof(name) - 1] = 0;
    std::size_t n = 0;
    while (n < got && name[n]) ++n;
    if (n < 4 || n >= sizeof(name) - 1) return {};
    for (std::size_t i = 0; i < n; ++i) {
        const unsigned char c = static_cast<unsigned char>(name[i]);
        if (c < 0x20 || c > 0x7e) return {};
    }
    return std::string(name, n);
}

static void printEmbeddedOwners(HANDLE process, const HostInfo& host, std::uintptr_t object) {
    unsigned emitted = 0;
    for (std::size_t back = 8; back <= 0x800 && object >= back; back += 8) {
        const auto base = object - back;
        std::uintptr_t vt = 0;
        if (!readVal(process, base, vt) || !inKernel(vt, host)) continue;
        const auto name = rttiNameForVtable(process, host, vt);
        if (name.empty()) continue;
        std::cout << "  embedded_owner_candidate=0x" << std::hex << base
                  << " bucket_off=0x" << back
                  << " vtable_rva=0x" << (vt - host.kernelBase) << std::dec
                  << " rtti='" << name << "'\n";
        if (++emitted >= 8) break;
    }
    if (!emitted) std::cout << "  embedded_owner_candidate=none\n";
}

static std::vector<std::uintptr_t> findQword(const std::vector<Region>& regions, std::uintptr_t value) {
    std::vector<std::uintptr_t> out;
    for (const auto& r : regions) {
        for (std::size_t i = 0; i + 8 <= r.bytes.size(); i += 8) {
            std::uintptr_t q = 0;
            std::memcpy(&q, r.bytes.data() + i, 8);
            if (q == value) out.push_back(r.base + i);
        }
    }
    return out;
}

static std::vector<std::uintptr_t> findBytes(const std::vector<Region>& regions, const std::string& needle) {
    std::vector<std::uintptr_t> out;
    if (needle.empty()) return out;
    for (const auto& r : regions) {
        auto it = r.bytes.begin();
        while (it != r.bytes.end()) {
            it = std::search(it, r.bytes.end(), needle.begin(), needle.end());
            if (it == r.bytes.end()) break;
            out.push_back(r.base + static_cast<std::uintptr_t>(it - r.bytes.begin()));
            ++it;
        }
    }
    return out;
}

static std::vector<unsigned char> decodeHex(const std::string& text) {
    if (text.size() % 2 != 0) return {};
    std::vector<unsigned char> out;
    out.reserve(text.size() / 2);
    auto hex = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    };
    for (std::size_t i = 0; i < text.size(); i += 2) {
        const int hi = hex(text[i]), lo = hex(text[i + 1]);
        if (hi < 0 || lo < 0) return {};
        out.push_back(static_cast<unsigned char>((hi << 4) | lo));
    }
    return out;
}

static std::vector<std::uintptr_t> findRawBytes(
    const std::vector<Region>& regions, const std::vector<unsigned char>& needle) {
    std::vector<std::uintptr_t> out;
    if (needle.empty()) return out;
    for (const auto& r : regions) {
        auto it = r.bytes.begin();
        while (it != r.bytes.end()) {
            it = std::search(it, r.bytes.end(), needle.begin(), needle.end());
            if (it == r.bytes.end()) break;
            out.push_back(r.base + static_cast<std::uintptr_t>(it - r.bytes.begin()));
            ++it;
        }
    }
    return out;
}

static void printVtableObjects(
    HANDLE process, const HostInfo& host, const std::vector<Region>& regions,
    const std::string& typeName, const std::vector<std::uintptr_t>& vtables) {
    std::cout << "type='" << typeName << "' vtables=" << vtables.size() << "\n";
    for (const auto vt : vtables) {
        const auto refs = findQword(regions, vt);
        std::cout << " vtable=0x" << std::hex << vt
                  << " rva=0x" << (vt - host.kernelBase) << std::dec
                  << " private_objects=" << refs.size() << "\n";
        for (std::size_t i = 0; i < refs.size() && i < 64; ++i) {
            std::cout << "  obj=0x" << std::hex << refs[i] << std::dec;
            const auto nm = rttiNameForVtable(process, host, vt);
            if (!nm.empty()) std::cout << " rtti='" << nm << "'";
            std::cout << "\n";
        }
    }
}

static void printNearbyRttiObjects(
    HANDLE process, const HostInfo& host, std::uintptr_t hit, std::size_t radius = 0x800) {
    unsigned emitted = 0;
    const auto start = hit > radius ? hit - radius : 0;
    for (std::uintptr_t p = start; p <= hit && p + 8 > p; p += 8) {
        std::uintptr_t vt = 0;
        if (!readVal(process, p, vt) || !inKernel(vt, host)) continue;
        const auto name = rttiNameForVtable(process, host, vt);
        if (name.empty()) continue;
        std::cout << "  nearby_rtti_obj=0x" << std::hex << p
                  << " delta=0x" << (hit - p)
                  << " vtable_rva=0x" << (vt - host.kernelBase) << std::dec
                  << " rtti='" << name << "'\n";
        if (++emitted >= 16) break;
    }
    if (!emitted) std::cout << "  nearby_rtti_obj=none\n";
}

static std::vector<Bucket> findBuckets(const std::vector<Region>& regions,
                                       std::uintptr_t bucketVtable) {
    std::vector<Bucket> out;
    for (const auto& r : regions) {
        for (std::size_t i = 0; i + 0x28 <= r.bytes.size(); i += 8) {
            std::uintptr_t q = 0;
            std::memcpy(&q, r.bytes.data() + i, 8);
            if (q != bucketVtable) continue;
            Bucket b{};
            b.address = r.base + i;
            std::memcpy(&b.tokens, r.bytes.data() + i + 0x10, 8);
            std::memcpy(&b.timestamp, r.bytes.data() + i + 0x18, 8);
            std::memcpy(&b.rate, r.bytes.data() + i + 0x20, 4);
            std::memcpy(&b.denominator, r.bytes.data() + i + 0x24, 4);
            out.push_back(b);
        }
    }
    return out;
}

static void printContainerCandidates(HANDLE process, const HostInfo& host,
                                     std::uintptr_t refAddr, std::uintptr_t target) {
    std::cout << "  ref=0x" << std::hex << refAddr << std::dec;
    unsigned emitted = 0;
    for (std::size_t back = 0; back <= 0x200 && refAddr >= back; back += 8) {
        const auto base = refAddr - back;
        std::uintptr_t vt = 0;
        if (!readVal(process, base, vt) || !inKernel(vt, host)) continue;
        const auto name = rttiNameForVtable(process, host, vt);
        std::cout << " container_candidate=0x" << std::hex << base
                  << " ref_off=0x" << back
                  << " vtable_rva=0x" << (vt - host.kernelBase) << std::dec;
        if (!name.empty()) std::cout << " rtti='" << name << "'";
        if (++emitted >= 4) break;
    }
    if (!emitted) std::cout << " container_candidate=none";
    std::cout << " target=0x" << std::hex << target << std::dec << "\n";
}

int main(int argc, char** argv) {
    const std::string taskKey = argc > 1 ? argv[1] : "";
    HostInfo host{};
    if (!findKernelHost(host)) {
        std::cerr << "kernel.dll host not found\n";
        return 2;
    }
    HANDLE process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, host.pid);
    if (!process) {
        std::cerr << "OpenProcess failed: " << GetLastError() << "\n";
        return 3;
    }

    // kernel.dll 3.0.20.234 / SHA-256 prefix 40EB35FC.
    const auto bucketVtable = host.kernelBase + 0x13BD438;
    const auto entityVtable = host.kernelBase + 0x13500C8;

    const auto regions = snapshotReadablePrivate(process);
    // These control-block vtable RVAs are recovered from on-disk MSVC RTTI for
    // kernel.dll 3.0.20.234 / SHA-256 prefix 40EB35FC. The wrapped qingluan
    // EntityTask/NetGrid classes are not themselves polymorphic here, so their
    // std::_Ref_count_obj2 control blocks are the stable runtime anchors.
    printVtableObjects(process, host, regions,
        ".?AV?$_Ref_count_obj2@VEntityTask@download@qingluan@@@std@@",
        {host.kernelBase + 0x1399AC8});
    printVtableObjects(process, host, regions,
        ".?AV?$_Ref_count_obj2@VNetGrid@download@qingluan@@@std@@",
        {host.kernelBase + 0x13BDC28});
    std::size_t totalBytes = 0;
    for (const auto& r : regions) totalBytes += r.bytes.size();

    std::cout << "mode=read-only pid=" << host.pid
              << " kernel_base=0x" << std::hex << host.kernelBase
              << " kernel_size=0x" << host.kernelSize
              << " bucket_vtable=0x" << bucketVtable
              << " entity_vtable=0x" << entityVtable << std::dec
              << " private_regions=" << regions.size()
              << " snap_bytes=" << totalBytes << "\n";

    const auto buckets = findBuckets(regions, bucketVtable);
    std::cout << "bucket_count=" << buckets.size() << "\n";
    for (const auto& b : buckets) {
        std::cout << "bucket obj=0x" << std::hex << b.address << std::dec
                  << " rate=" << b.rate
                  << " rate_kib=" << std::fixed << std::setprecision(2)
                  << static_cast<double>(b.rate) / 1024.0
                  << " token=" << b.tokens
                  << " ts=" << b.timestamp
                  << " denom=" << b.denominator << "\n";
        printEmbeddedOwners(process, host, b.address);
        const auto refs = findQword(regions, b.address);
        std::cout << " bucket_refs=" << refs.size() << "\n";
        for (std::size_t i = 0; i < refs.size() && i < 24; ++i)
            printContainerCandidates(process, host, refs[i], b.address);
    }

    const auto entities = findQword(regions, entityVtable);
    std::cout << "entity_vtable_rtti='" << rttiNameForVtable(process, host, entityVtable)
              << "' entity_vtable_refs=" << entities.size() << "\n";
    for (std::size_t i = 0; i < entities.size() && i < 64; ++i) {
        const auto ent = entities[i];
        std::array<unsigned char, 16> taskId{};
        std::uintptr_t ng0 = 0, ng1 = 0, ngVt = 0;
        SIZE_T got = 0;
        ReadProcessMemory(process, reinterpret_cast<LPCVOID>(ent + 0x24),
                          taskId.data(), taskId.size(), &got);
        readVal(process, ent + 0x108, ng0);
        readVal(process, ent + 0x110, ng1);
        if (ng0) readVal(process, ng0, ngVt);
        std::cout << "entity obj=0x" << std::hex << ent
                  << " taskid_hex=" << hex16(taskId)
                  << " ng0=0x" << ng0 << " ng1=0x" << ng1;
        if (ngVt) {
            std::cout << " ng_vtable=0x" << ngVt;
            if (inKernel(ngVt, host)) {
                std::cout << " ng_vtable_rva=0x" << (ngVt - host.kernelBase);
                const auto ngName = rttiNameForVtable(process, host, ngVt);
                if (!ngName.empty()) std::cout << " ng_rtti='" << ngName << "'";
            }
        }
        std::cout << std::dec << " taskid_ascii='" << ascii16(taskId) << "'\n";

        if (ng0) {
            std::array<unsigned char, 0x400> ngBytes{};
            SIZE_T ngGot = 0;
            if (ReadProcessMemory(process, reinterpret_cast<LPCVOID>(ng0),
                                  ngBytes.data(), ngBytes.size(), &ngGot) && ngGot >= 8) {
                for (std::size_t off = 0; off + 8 <= ngGot; off += 8) {
                    std::uintptr_t q = 0;
                    std::memcpy(&q, ngBytes.data() + off, 8);
                    if (q == bucketVtable)
                        std::cout << "  ng_embedded_bucket_vtable off=0x" << std::hex << off << std::dec << "\n";
                    for (const auto& b : buckets) {
                        if (q == b.address)
                            std::cout << "  ng_bucket_ptr off=0x" << std::hex << off
                                      << " bucket=0x" << b.address << std::dec << "\n";
                    }
                }
            }
        }
    }

    if (!taskKey.empty()) {
        const auto hits = findBytes(regions, taskKey);
        std::cout << "task_key='" << taskKey << "' ascii_hits=" << hits.size() << "\n";
        for (std::size_t i = 0; i < hits.size() && i < 64; ++i) {
            std::cout << " task_key_hit=0x" << std::hex << hits[i] << std::dec << "\n";
            const auto refs = findQword(regions, hits[i]);
            for (std::size_t j = 0; j < refs.size() && j < 12; ++j)
                printContainerCandidates(process, host, refs[j], hits[i]);
        }
    }

    if (taskKey.size() == 32) {
        const auto raw = decodeHex(taskKey);
        const auto rawHits = findRawBytes(regions, raw);
        std::cout << "task_key_hex='" << taskKey << "' binary_hits=" << rawHits.size() << "\n";
        for (std::size_t i = 0; i < rawHits.size() && i < 64; ++i) {
            std::cout << " binary_hit=0x" << std::hex << rawHits[i] << std::dec << "\n";
            printNearbyRttiObjects(process, host, rawHits[i]);
        }
    }

    CloseHandle(process);
    return 0;
}
