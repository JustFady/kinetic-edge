#pragma once
// ══════════════════════════════════════════════════════════════════════════════
// Project Kinetic-Edge — Frame Ingestion Header
// ══════════════════════════════════════════════════════════════════════════════

#include <cstdint>
#include <string>
#include <vector>
#include <chrono>

namespace kinetic {

constexpr size_t HEADER_SIZE = 24;

struct FrameHeader {
    uint64_t timestamp_us;
    uint32_t frame_id;
    uint32_t width;
    uint32_t height;
    uint32_t channels;
};

inline std::vector<uint8_t> serialize_header(const FrameHeader& hdr) {
    std::vector<uint8_t> buf(HEADER_SIZE);
    std::memcpy(buf.data(),      &hdr.timestamp_us, 8);
    std::memcpy(buf.data() + 8,  &hdr.frame_id,     4);
    std::memcpy(buf.data() + 12, &hdr.width,         4);
    std::memcpy(buf.data() + 16, &hdr.height,        4);
    std::memcpy(buf.data() + 20, &hdr.channels,      4);
    return buf;
}

inline uint64_t now_us() {
    auto now = std::chrono::high_resolution_clock::now();
    return static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::microseconds>(
            now.time_since_epoch()
        ).count()
    );
}

struct IngestConfig {
    std::string video_path;
    std::string zmq_endpoint = "tcp://127.0.0.1:5555";
    int target_width  = 640;
    int target_height = 480;
    int max_frames    = 0;
    int frame_skip    = 1;
    int send_hwm      = 100;
};

} // namespace kinetic
