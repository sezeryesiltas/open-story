import packageJson from '@/package.json';

function normalizeBuildNumber(value: string | undefined): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return 'local';
  }

  if (/^[0-9a-f]{40}$/i.test(trimmedValue)) {
    return trimmedValue.slice(0, 7);
  }

  return trimmedValue;
}

export const adminBuildInfo = {
  version: packageJson.version,
  buildNumber: normalizeBuildNumber(process.env.NEXT_PUBLIC_OPEN_STORY_BUILD_NUMBER),
};

export const adminBuildLabel = `Build v${adminBuildInfo.version} · ${adminBuildInfo.buildNumber}`;
