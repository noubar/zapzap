cmake_minimum_required(VERSION 3.22.1)

project(zapzap_signal)

add_library(zapzap_signal SHARED ZapZapSignal.cpp)

find_package(oboe REQUIRED CONFIG)

target_compile_features(zapzap_signal PRIVATE cxx_std_17)
target_compile_options(zapzap_signal PRIVATE -O3)
target_link_options(zapzap_signal PRIVATE
  "-Wl,-z,max-page-size=16384"
  "-Wl,-z,common-page-size=16384"
)

target_link_libraries(zapzap_signal oboe::oboe android log)
