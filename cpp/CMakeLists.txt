# ── Ingest Executable ─────────────────────────────────────────────────────────
add_executable(ingest
    src/ingest.cpp
)

target_include_directories(ingest PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${OpenCV_INCLUDE_DIRS}
)

target_link_libraries(ingest PRIVATE
    ${OpenCV_LIBS}
    cppzmq
)

# ── Install target ────────────────────────────────────────────────────────────
install(TARGETS ingest DESTINATION bin)
