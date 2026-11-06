#include "frame_codec.h"

#include <limits.h>
#include <string.h>

_Static_assert(CHAR_BIT == 8, "The wire format requires 8-bit bytes");

static uint16_t read_le16(const uint8_t *src)
{
    return (uint16_t)((uint16_t)src[0] | ((uint32_t)src[1] << 8U));
}

static uint32_t read_le32(const uint8_t *src)
{
    return (uint32_t)src[0] | ((uint32_t)src[1] << 8U) |
           ((uint32_t)src[2] << 16U) | ((uint32_t)src[3] << 24U);
}

static void write_le16(uint8_t *dst, uint16_t value)
{
    dst[0] = (uint8_t)(value & UINT16_C(0xff));
    dst[1] = (uint8_t)((value >> 8U) & UINT16_C(0xff));
}

static void write_le32(uint8_t *dst, uint32_t value)
{
    dst[0] = (uint8_t)(value & UINT32_C(0xff));
    dst[1] = (uint8_t)((value >> 8U) & UINT32_C(0xff));
    dst[2] = (uint8_t)((value >> 16U) & UINT32_C(0xff));
    dst[3] = (uint8_t)((value >> 24U) & UINT32_C(0xff));
}

uint16_t frame_crc16(const uint8_t *data, size_t length)
{
    uint16_t crc = UINT16_C(0xffff);

    for (size_t i = 0U; i < length; ++i) {
        crc = (uint16_t)(crc ^ ((uint32_t)data[i] << 8U));
        for (unsigned int bit = 0U; bit < 8U; ++bit) {
            const uint32_t shifted = (uint32_t)crc << 1U;
            crc = (uint16_t)(((crc & UINT16_C(0x8000)) != 0U)
                                ? shifted ^ UINT32_C(0x1021)
                                : shifted);
        }
    }
    return crc;
}

enum frame_result frame_encode(const struct frame_message *message,
                               uint8_t *dst, size_t capacity, size_t *written)
{
    uint8_t raw[FRAME_WIRE_SIZE] = {0};

    if ((message == NULL) || (dst == NULL) || (written == NULL)) {
        return FRAME_INVALID;
    }
    if (capacity < FRAME_WIRE_SIZE) {
        return FRAME_TRUNCATED;
    }
    raw[0] = UINT8_C(0xa5);
    raw[1] = UINT8_C(0x5a);
    raw[2] = 1U;
    raw[4] = 4U;

    switch (message->kind) {
    case FRAME_KIND_ADC:
        raw[3] = 1U;
        write_le16(&raw[6], message->data.adc.code);
        write_le16(&raw[8], message->data.adc.reference_mv);
        break;
    case FRAME_KIND_STATUS:
        raw[3] = 2U;
        write_le32(&raw[6], message->data.status.flags);
        break;
    default:
        return FRAME_UNSUPPORTED;
    }

    write_le16(&raw[10], frame_crc16(raw, 10U));
    memcpy(dst, raw, sizeof(raw));
    *written = sizeof(raw);
    return FRAME_OK;
}

enum frame_result frame_decode(const uint8_t *src, size_t length,
                               struct frame_message *out)
{
    struct frame_message parsed = {0};

    if ((src == NULL) || (out == NULL)) {
        return FRAME_INVALID;
    }
    if (length < FRAME_WIRE_SIZE) {
        return FRAME_TRUNCATED;
    }
    if ((length != FRAME_WIRE_SIZE) || (src[0] != UINT8_C(0xa5)) ||
        (src[1] != UINT8_C(0x5a)) || (read_le16(&src[4]) != 4U)) {
        return FRAME_INVALID;
    }
    if ((src[2] != 1U) || ((src[3] != 1U) && (src[3] != 2U))) {
        return FRAME_UNSUPPORTED;
    }
    if (read_le16(&src[10]) != frame_crc16(src, 10U)) {
        return FRAME_BAD_CRC;
    }

    if (src[3] == 1U) {
        parsed.kind = FRAME_KIND_ADC;
        parsed.data.adc.code = read_le16(&src[6]);
        parsed.data.adc.reference_mv = read_le16(&src[8]);
    } else {
        parsed.kind = FRAME_KIND_STATUS;
        parsed.data.status.flags = read_le32(&src[6]);
    }
    *out = parsed;
    return FRAME_OK;
}
