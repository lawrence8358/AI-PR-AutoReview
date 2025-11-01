import { DevOpsService } from '../src/services/devops.service';

async function run() {
    // 初始化 DevOps API
    const accessToken = process.env.DevOpsAccessToken;
    const organizationUrl = process.env.DevOpsOrgUrl;
    const devOpsService = new DevOpsService(accessToken, organizationUrl);

    // DevOps 相關設定
    const projectName = process.env.DevOpsProjectName || '';
    const repositoryId = process.env.DevOpsRepositoryId || '';
    const pullRequestId = +(process.env.DevOpsPRId || '0');
    const fileExtensions = process.env.FileExtensions?.split(',').filter(ext => ext) || [];
    const binaryExtensions = process.env.BinaryExtensions?.split(',').filter(ext => ext) || [];
    const enableThrottleMode = (process.env.EnableThrottleMode ?? 'true').toLowerCase() === 'true';

    // 取得 PR 變更檔案
    const changes = await devOpsService.getPullRequestChanges(
        projectName,
        repositoryId,
        pullRequestId,
        fileExtensions,  // 要包含的檔案類型
        binaryExtensions,  // 要排除的檔案類型
        enableThrottleMode  // 節流模式
    );

    if (!changes) {
        console.log('❌ 沒有找到符合條件的變更檔案');
        return;
    }

    for (const change of changes) {
        console.log(`🔍 檔案路徑: ${change.path}`);
        console.log(`📝 變更類型: ${change.changeType}`);
        console.log(`📄 檔案內容:\n${change.content}\n`);
    }
}

run().catch(err => {
    console.error('⛔ Unhandled error: ' + err.message);
    process.exit(1);
});