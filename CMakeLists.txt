cmake_minimum_required(VERSION 3.16)
project(KineticEdge
    VERSION 0.1.0
    DESCRIPTION "Local Video AI Evaluation Pipeline"
    LANGUAGES CXX
)

# ── C++ Standard ──────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ── Build type defaults ──────────────────────────────────────────────────────
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

# ── Compiler warnings ────────────────────────────────────────────────────────
add_compile_options(-Wall -Wextra -Wpedantic)

# ── Dependencies ──────────────────────────────────────────────────────────────
find_package(OpenCV REQUIRED COMPONENTS core imgproc videoio highgui)
find_package(cppzmq REQUIRED)

message(STATUS "OpenCV version: ${OpenCV_VERSION}")
message(STATUS "OpenCV libraries: ${OpenCV_LIBS}")
message(STATUS "cppzmq found: ${cppzmq_DIR}")

# ── Sub-projects ──────────────────────────────────────────────────────────────
add_subdirectory(cpp)
