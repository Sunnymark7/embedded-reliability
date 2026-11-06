#ifndef EMBEDDED_FRAME_CODEC_H
#define EMBEDDED_FRAME_CODEC_H

#include <stddef.h>
#include <stdint.h>

/* Teaching protocol only. Not a hardware protocol or an authentication layer. */
#define FRAME_WIRE_SIZE 12U

enum frame_kind {
    FRAME_KIND_ADC = 1,
    FRAME_KIND_STATUS = 2
};

enum frame_result {
    FRAME_OK = 0,
    FRAME_INVALID,
    FRAME_TRUNCATED,
    FRAME_UNSUPPORTED,
    FRAME_BAD_CRC
};

struct frame_message {
    enum frame_kind kind;
    union {
        struct {
            uint16_t code;
            uint16_t reference_mv;
        } adc;
        struct {
            uint32_t flags;
        } status;
    } data;
};

/* data must point to length valid bytes; NULL is permitted only for length=0.
 * CRC-16/CCITT-FALSE, poly=0x1021, init=0xffff, no reflection/xorout.
 * Thread-safe for independent buffers; no allocation or retained references.
 */
uint16_t frame_crc16(const uint8_t *data, size_t length);

/* All non-NULL pointers must designate valid objects of the declared sizes.
 * message, dst[capacity], and written must not overlap. No retained references.
 * message->kind must identify its initialized union member.
 * On success writes exactly FRAME_WIRE_SIZE bytes and sets *written.
 * On failure dst and *written remain unchanged. NULL pointers are invalid,
 * even with capacity=0. Caller owns every object before and after the call.
 */
enum frame_result frame_encode(const struct frame_message *message,
                               uint8_t *dst, size_t capacity, size_t *written);

/* src[length] and *out must not overlap. Requires exactly one complete frame.
 * No stream buffering, hardware access, allocation, or callbacks.
 * On any failure *out remains unchanged. Unknown versions/kinds are rejected.
 * Payload physical validity (ADC resolution, reference range) is caller policy.
 */
enum frame_result frame_decode(const uint8_t *src, size_t length,
                               struct frame_message *out);

#endif
