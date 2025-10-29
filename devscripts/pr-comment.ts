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

    // 新增 AI 分析結果為 PR 評論
    const commentHeader = `自動化評論標頭`;
    await devOpsService.addPullRequestComment(
        projectName,
        repositoryId,
        pullRequestId,
        `這是一則來自自動化工具的評論範例**測試內容**\n- 建議 1:請根據實際分析結果進行修改。`,
        commentHeader
    );
}

run().catch(err => {
    console.error('⛔ Unhandled error: ' + err.message);
    process.exit(1);
});