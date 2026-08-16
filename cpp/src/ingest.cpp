// ══════════════════════════════════════════════════════════════════════════════
// Project Kinetic-Edge — Video Ingestion Module
// ══════════════════════════════════════════════════════════════════════════════

#include "ingest.h"
#include <opencv2/opencv.hpp>
#include <zmq.hpp>
#include <iostream>
#include <iomanip>
#include <string>
#include <chrono>
#include <cstring>
#include <csignal>
#include <atomic>
#include <thread> // Added for sleep

static std::atomic<bool> g_running{true};

void signal_handler(int /*sig*/) {
    g_running = false;
}

struct Args {
    kinetic::IngestConfig cfg;
    bool help = false;
};

Args parse_args(int argc, char* argv[]) {
    Args args;
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--help" || a == "-h") {
            args.help = true;
        } else if (a == "--video" && i + 1 < argc) {
            args.cfg.video_path = argv[++i];
        } else if (a == "--endpoint" && i + 1 < argc) {
            args.cfg.zmq_endpoint = argv[++i];
        } else if (a == "--width" && i + 1 < argc) {
            args.cfg.target_width = std::stoi(argv[++i]);
        } else if (a == "--height" && i + 1 < argc) {
            args.cfg.target_height = std::stoi(argv[++i]);
        } else if (a == "--max-frames" && i + 1 < argc) {
            args.cfg.max_frames = std::stoi(argv[++i]);
        } else if (a == "--frame-skip" && i + 1 < argc) {
            args.cfg.frame_skip = std::stoi(argv[++i]);
        } else if (a == "--config" && i + 1 < argc) {
            ++i; // skip value
        }
    }
    return args;
}

void print_usage(const char* prog) {
    std::cout << "Usage: " << prog << " --video <path> [options]\n";
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT,  signal_handler);
    std::signal(SIGTERM, signal_handler);

    Args args = parse_args(argc, argv);

    if (args.help) {
        print_usage(argv[0]);
        return 0;
    }

    if (args.cfg.video_path.empty()) {
        std::cerr << "ERROR: --video <path> is required.\n";
        print_usage(argv[0]);
        return 1;
    }

    const auto& cfg = args.cfg;
    cv::VideoCapture cap(cfg.video_path);
    if (!cap.isOpened()) {
        std::cerr << "ERROR: Cannot open video: " << cfg.video_path << "\n";
        return 1;
    }

    zmq::context_t ctx(1);
    zmq::socket_t  sender(ctx, zmq::socket_type::push);
    sender.set(zmq::sockopt::sndhwm, cfg.send_hwm);
    sender.set(zmq::sockopt::linger, 2000); // 2 seconds socket linger
    sender.connect(cfg.zmq_endpoint);

    cv::Mat frame, resized;
    resized.create(cfg.target_height, cfg.target_width, CV_8UC3);

    uint32_t frame_id = 0, sent_count = 0, dropped = 0;

    while (g_running && cap.read(frame)) {
        frame_id++;
        if (cfg.frame_skip > 1 && (frame_id % cfg.frame_skip != 0)) continue;
        if (cfg.max_frames > 0 && sent_count >= static_cast<uint32_t>(cfg.max_frames)) break;

        cv::resize(frame, resized, cv::Size(cfg.target_width, cfg.target_height), 0, 0, cv::INTER_LINEAR);

        kinetic::FrameHeader hdr;
        hdr.timestamp_us = kinetic::now_us();
        hdr.frame_id = frame_id;
        hdr.width = cfg.target_width;
        hdr.height = cfg.target_height;
        hdr.channels = 3;

        auto hdr_bytes = kinetic::serialize_header(hdr);
        size_t pixel_bytes = cfg.target_width * cfg.target_height * 3;
        size_t msg_size = kinetic::HEADER_SIZE + pixel_bytes;

        zmq::message_t msg(msg_size);
        std::memcpy(msg.data(), hdr_bytes.data(), kinetic::HEADER_SIZE);
        std::memcpy(static_cast<uint8_t*>(msg.data()) + kinetic::HEADER_SIZE, resized.data, pixel_bytes);

        if (sender.send(msg, zmq::send_flags::dontwait).has_value()) {
            sent_count++;
        } else {
            dropped++;
        }

        if (sent_count % 50 == 0 && sent_count > 0) {
            std::cout << "  [ingest] frame " << frame_id << " sent (dropped: " << dropped << ")\n";
        }
    }

    {
        std::string end_msg = "END";
        zmq::message_t sentinel(end_msg.data(), end_msg.size());
        sender.send(sentinel, zmq::send_flags::none);
    }

    std::cout << "Ingestion Complete. Sent: " << sent_count << " (dropped: " << dropped << ")\n";
    
    // Sleep to allow ZMQ background threads to flush messages to the consumer
    std::this_thread::sleep_for(std::chrono::seconds(2));

    sender.close();
    ctx.close();
    return 0;
}
