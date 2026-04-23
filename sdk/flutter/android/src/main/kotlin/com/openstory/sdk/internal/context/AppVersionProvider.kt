package com.openstory.sdk.internal.context

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

internal class AppVersionProvider(
    private val context: Context,
) {
    fun versionName(): String {
        return runCatching {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.PackageInfoFlags.of(0L),
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }

            packageInfo.versionName?.trim().takeUnless { it.isNullOrEmpty() } ?: "0.0.0"
        }.getOrDefault("0.0.0")
    }
}
