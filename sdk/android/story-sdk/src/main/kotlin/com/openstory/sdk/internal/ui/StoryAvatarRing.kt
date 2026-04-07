package com.openstory.sdk.internal.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import androidx.annotation.ColorInt

internal const val STORY_BAR_AVATAR_RING_DIAMETER_DP = 67.05f
internal const val STORY_BAR_AVATAR_IMAGE_DIAMETER_DP = 55.62f
internal const val STORY_BAR_AVATAR_RING_STROKE_WIDTH_DP = 3.53f

internal data class StoryAvatarRingColors(
    @ColorInt val startColor: Int,
    @ColorInt val endColor: Int,
)

internal fun storyAvatarRingColors(
    isViewed: Boolean,
    isCached: Boolean,
): StoryAvatarRingColors {
    return when {
        isViewed -> StoryAvatarRingColors(
            startColor = 0xFFD8CEC2.toInt(),
            endColor = 0xFFBDB2A6.toInt(),
        )
        isCached -> StoryAvatarRingColors(
            startColor = 0xFFC3A173.toInt(),
            endColor = 0xFFB4845D.toInt(),
        )
        else -> StoryAvatarRingColors(
            startColor = 0xFFF59E0B.toInt(),
            endColor = 0xFF8B5CF6.toInt(),
        )
    }
}

internal fun storyAvatarRingDiameterDpForImage(imageDiameterDp: Float): Float {
    return imageDiameterDp * STORY_BAR_AVATAR_RING_DIAMETER_DP / STORY_BAR_AVATAR_IMAGE_DIAMETER_DP
}

internal fun storyAvatarRingStrokeWidthDpForImage(imageDiameterDp: Float): Float {
    return imageDiameterDp * STORY_BAR_AVATAR_RING_STROKE_WIDTH_DP / STORY_BAR_AVATAR_IMAGE_DIAMETER_DP
}

internal class GradientRingView(
    context: Context,
    @ColorInt startColor: Int,
    @ColorInt endColor: Int,
    private val strokeWidthPx: Float,
) : View(context) {
    private val ovalBounds = RectF()
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = strokeWidthPx
    }
    @ColorInt
    private var currentStartColor: Int = startColor
    @ColorInt
    private var currentEndColor: Int = endColor

    fun updateColors(
        @ColorInt startColor: Int,
        @ColorInt endColor: Int,
    ) {
        if (currentStartColor == startColor && currentEndColor == endColor) {
            return
        }

        currentStartColor = startColor
        currentEndColor = endColor
        updateShader(width, height)
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        updateShader(w, h)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawOval(ovalBounds, ringPaint)
    }

    private fun updateShader(w: Int, h: Int) {
        if (w <= 0 || h <= 0) {
            return
        }

        val inset = strokeWidthPx / 2f
        ovalBounds.set(inset, inset, w.toFloat() - inset, h.toFloat() - inset)
        ringPaint.shader = LinearGradient(
            0f,
            0f,
            w.toFloat(),
            h.toFloat(),
            currentStartColor,
            currentEndColor,
            Shader.TileMode.CLAMP,
        )
    }
}