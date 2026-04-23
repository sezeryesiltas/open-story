package com.openstory.sdk.internal.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.view.View
import androidx.annotation.ColorInt

internal class LinearGradientView(
    context: Context,
    @ColorInt private val colors: IntArray,
) : View(context) {
    private val gradientPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w <= 0 || h <= 0) {
            return
        }

        gradientPaint.shader = LinearGradient(
            w / 2f,
            0f,
            w / 2f,
            h.toFloat(),
            colors,
            null,
            Shader.TileMode.CLAMP,
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), gradientPaint)
    }
}