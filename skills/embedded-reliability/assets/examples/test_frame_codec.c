#include "frame_codec.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef NDEBUG
#error Tests require active assertions
#endif

static unsigned long checks = 0UL;

#define CHECK(condition) do { ++checks; assert(condition); } while (0)

/* Independently generated using Python binascii.crc_hqx(prefix, 0xffff). */
static const uint8_t golden[FRAME_WIRE_SIZE] = {
    0xa5U, 0x5aU, 0x01U, 0x01U, 0x04U, 0x00U,
    0x34U, 0x12U, 0xe4U, 0x0cU, 0x3dU, 0x32U
};

static uint32_t next_random(uint32_t *state)
{
    *state ^= *state << 13U;
    *state ^= *state >> 17U;
    *state ^= *state << 5U;
    return *state;
}

static void expect_decode_failure(const uint8_t *src, size_t length,
                                  enum frame_result expected)
{
    struct frame_message out = {0};
    unsigned char before[sizeof(out)];

    out.kind = FRAME_KIND_STATUS;
    out.data.status.flags = UINT32_C(0x12345678);
    memcpy(before, &out, sizeof(out));
    CHECK(frame_decode(src, length, &out) == expected);
    /* Byte snapshot checks non-modification, not semantic struct equality. */
    CHECK(memcmp(before, &out, sizeof(out)) == 0);
}

static void test_golden_and_crc(void)
{
    static const uint8_t check_input[] = "123456789";
    const struct frame_message input = {
        FRAME_KIND_ADC, {.adc = {UINT16_C(0x1234), UINT16_C(3300)}}
    };
    struct frame_message decoded = {0};
    uint8_t guarded[FRAME_WIRE_SIZE + 2U];
    size_t written = 99U;

    CHECK(frame_crc16(check_input, sizeof(check_input) - 1U) ==
          UINT16_C(0x29b1));
    CHECK(frame_crc16(NULL, 0U) == UINT16_C(0xffff));
    memset(guarded, 0xcc, sizeof(guarded));
    CHECK(frame_encode(&input, &guarded[1], FRAME_WIRE_SIZE, &written) ==
          FRAME_OK);
    CHECK(written == FRAME_WIRE_SIZE);
    CHECK(guarded[0] == 0xccU);
    CHECK(guarded[FRAME_WIRE_SIZE + 1U] == 0xccU);
    CHECK(memcmp(&guarded[1], golden, sizeof(golden)) == 0);
    CHECK(frame_decode(golden, sizeof(golden), &decoded) == FRAME_OK);
    CHECK(decoded.kind == FRAME_KIND_ADC);
    CHECK(decoded.data.adc.code == input.data.adc.code);
    CHECK(decoded.data.adc.reference_mv == input.data.adc.reference_mv);
}

static void test_failures(void)
{
    struct frame_message input = {0};
    uint8_t bad[FRAME_WIRE_SIZE + 1U];
    uint8_t dst[FRAME_WIRE_SIZE];
    uint8_t before[FRAME_WIRE_SIZE];
    size_t written = 77U;

    input.kind = FRAME_KIND_STATUS;
    input.data.status.flags = 0U;
    memset(dst, 0x6d, sizeof(dst));
    memcpy(before, dst, sizeof(dst));

    for (size_t capacity = 0U; capacity < FRAME_WIRE_SIZE; ++capacity) {
        CHECK(frame_encode(&input, dst, capacity, &written) == FRAME_TRUNCATED);
        CHECK(written == 77U);
        CHECK(memcmp(before, dst, sizeof(dst)) == 0);
    }
    CHECK(frame_encode(NULL, dst, sizeof(dst), &written) == FRAME_INVALID);
    CHECK(frame_encode(&input, NULL, sizeof(dst), &written) == FRAME_INVALID);
    CHECK(frame_encode(&input, dst, sizeof(dst), NULL) == FRAME_INVALID);
    input.kind = (enum frame_kind)99;
    CHECK(frame_encode(&input, dst, sizeof(dst), &written) == FRAME_UNSUPPORTED);
    CHECK(written == 77U);
    CHECK(memcmp(before, dst, sizeof(dst)) == 0);

    expect_decode_failure(NULL, 0U, FRAME_INVALID);
    CHECK(frame_decode(golden, sizeof(golden), NULL) == FRAME_INVALID);
    for (size_t length = 0U; length < FRAME_WIRE_SIZE; ++length) {
        expect_decode_failure(golden, length, FRAME_TRUNCATED);
    }
    /* Exact-size allocations let ASan detect reads beyond each short object,
     * instead of only checking logical lengths inside a full-size buffer. */
    for (size_t length = 1U; length < FRAME_WIRE_SIZE; ++length) {
        uint8_t *short_frame = malloc(length);
        CHECK(short_frame != NULL);
        memcpy(short_frame, golden, length);
        expect_decode_failure(short_frame, length, FRAME_TRUNCATED);
        free(short_frame);
    }
    memcpy(bad, golden, sizeof(golden));
    bad[FRAME_WIRE_SIZE] = 0U;
    expect_decode_failure(bad, sizeof(bad), FRAME_INVALID);
    bad[0] = 0U;
    expect_decode_failure(bad, FRAME_WIRE_SIZE, FRAME_INVALID);
    memcpy(bad, golden, sizeof(golden));
    bad[2] = 2U;
    expect_decode_failure(bad, FRAME_WIRE_SIZE, FRAME_UNSUPPORTED);
    memcpy(bad, golden, sizeof(golden));
    bad[3] = 99U;
    expect_decode_failure(bad, FRAME_WIRE_SIZE, FRAME_UNSUPPORTED);
    memcpy(bad, golden, sizeof(golden));
    bad[4] = 0xffU;
    bad[5] = 0xffU;
    expect_decode_failure(bad, FRAME_WIRE_SIZE, FRAME_INVALID);
    memcpy(bad, golden, sizeof(golden));
    bad[10] ^= 1U;
    expect_decode_failure(bad, FRAME_WIRE_SIZE, FRAME_BAD_CRC);

    for (size_t byte = 0U; byte < FRAME_WIRE_SIZE; ++byte) {
        for (unsigned int bit = 0U; bit < 8U; ++bit) {
            struct frame_message out = {0};
            unsigned char snapshot[sizeof(out)];
            memcpy(bad, golden, sizeof(golden));
            memcpy(snapshot, &out, sizeof(out));
            bad[byte] = (uint8_t)(bad[byte] ^ (uint8_t)(1U << bit));
            CHECK(frame_decode(bad, FRAME_WIRE_SIZE, &out) != FRAME_OK);
            CHECK(memcmp(snapshot, &out, sizeof(out)) == 0);
        }
    }
}

static void test_status_and_value_edges(void)
{
    static const uint8_t status_golden[FRAME_WIRE_SIZE] = {
        0xa5U, 0x5aU, 0x01U, 0x02U, 0x04U, 0x00U,
        0x78U, 0x56U, 0x34U, 0x12U, 0xa4U, 0xecU
    };
    static const uint16_t edges[] = {
        0U, 1U, 0xffU, 0x100U, 0x7fffU, 0x8000U, 0xfffeU, 0xffffU
    };
    struct frame_message input = {0};
    struct frame_message output = {0};
    uint8_t raw[FRAME_WIRE_SIZE];
    size_t written = 0U;

    input.kind = FRAME_KIND_STATUS;
    input.data.status.flags = UINT32_C(0x12345678);
    CHECK(frame_encode(&input, raw, sizeof(raw), &written) == FRAME_OK);
    CHECK(memcmp(raw, status_golden, sizeof(raw)) == 0);
    CHECK(frame_decode(status_golden, sizeof(status_golden), &output) == FRAME_OK);
    CHECK(output.kind == FRAME_KIND_STATUS);
    CHECK(output.data.status.flags == UINT32_C(0x12345678));

    for (size_t i = 0U; i < sizeof(edges) / sizeof(edges[0]); ++i) {
        input.kind = FRAME_KIND_ADC;
        input.data.adc.code = edges[i];
        input.data.adc.reference_mv = edges[i];
        CHECK(frame_encode(&input, raw, sizeof(raw), &written) == FRAME_OK);
        CHECK(frame_decode(raw, written, &output) == FRAME_OK);
        CHECK(output.kind == FRAME_KIND_ADC);
        CHECK(output.data.adc.code == edges[i]);
        CHECK(output.data.adc.reference_mv == edges[i]);
    }
}

static void test_randomized(void)
{
    uint32_t state = UINT32_C(0x70b29a13);

    for (unsigned int i = 0U; i < 10000U; ++i) {
        struct frame_message input = {0};
        struct frame_message output = {0};
        uint8_t raw[FRAME_WIRE_SIZE];
        uint8_t fuzz[64];
        unsigned char before[sizeof(output)];
        size_t written = 0U;
        size_t length;
        enum frame_result result;

        if ((i & 1U) == 0U) {
            input.kind = FRAME_KIND_ADC;
            input.data.adc.code = (uint16_t)(next_random(&state) & UINT32_C(0xffff));
            input.data.adc.reference_mv =
                (uint16_t)(next_random(&state) & UINT32_C(0xffff));
        } else {
            input.kind = FRAME_KIND_STATUS;
            input.data.status.flags = next_random(&state);
        }
        CHECK(frame_encode(&input, raw, sizeof(raw), &written) == FRAME_OK);
        CHECK(written == FRAME_WIRE_SIZE);
        CHECK(frame_decode(raw, written, &output) == FRAME_OK);
        CHECK(input.kind == output.kind);
        if (input.kind == FRAME_KIND_ADC) {
            CHECK(input.data.adc.code == output.data.adc.code);
            CHECK(input.data.adc.reference_mv == output.data.adc.reference_mv);
        } else {
            CHECK(input.data.status.flags == output.data.status.flags);
        }

        for (size_t j = 0U; j < sizeof(fuzz); ++j) {
            fuzz[j] = (uint8_t)(next_random(&state) & UINT32_C(0xff));
        }
        length = (size_t)(next_random(&state) % UINT32_C(65));
        memcpy(before, &output, sizeof(output));
        result = frame_decode(fuzz, length, &output);
        if (result != FRAME_OK) {
            CHECK(memcmp(before, &output, sizeof(output)) == 0);
        } else {
            CHECK((output.kind == FRAME_KIND_ADC) ||
                  (output.kind == FRAME_KIND_STATUS));
        }
    }
}

int main(void)
{
    test_golden_and_crc();
    test_failures();
    test_status_and_value_edges();
    test_randomized();
    printf("PASS: %lu checks; 10000 round trips and 10000 fuzz inputs\n", checks);
    return 0;
}
