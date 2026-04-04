import { DevOpsService } from '../interfaces/devops-service.interface';
import { DevOpsConnection } from '../interfaces/pipeline-inputs.interface';
import { InlineIssue, InlineReviewResult } from '../interfaces/inline-review.interface';

const SEVERITY_EMOJI: Record<string, string> = {
    critical: '🔴',
    warning: '⚠️',
    suggestion: '💡'
};

const MAX_INLINE_COMMENTS = 20;

type CommentTask = { filePath: string; lineStart: number; lineEnd: number; body: string };

/**
 * 解析 AI 回傳的行內審查 JSON 結果
 * 支援帶有 markdown code fence 的回應（```json ... ```）
 */
export function parseInlineReviewResult(content: string): InlineReviewResult | null {
    const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(content);
    const jsonStr = fenceMatch ? fenceMatch[1] : content;

    try {
        const result = JSON.parse(jsonStr.trim()) as InlineReviewResult;
        if (!result.summary || !Array.isArray(result.issues)) {
            console.warn('⚠️ Inline review JSON is missing required fields (summary, issues)');
            return null;
        }
        return result;
    } catch (e) {
        console.warn('⚠️ Failed to parse inline review JSON:', e);
        return null;
    }
}

/** 將單一 issue 格式化為評論內文 */
function formatIssueLines(issue: InlineIssue): string[] {
    const emoji = SEVERITY_EMOJI[issue.severity] ?? '💡';
    const lines = [`${emoji} **[${issue.category}]** ${issue.description}`];
    if (issue.suggestion) {
        lines.push('', `**Suggestion**: ${issue.suggestion}`);
    }
    return lines;
}

/** 建立摘要評論的 Markdown 內容 */
function buildSummaryLines(inlineResult: InlineReviewResult, strictMode: boolean, postedCount: number): string[] {
    const criticalCount = inlineResult.issues.filter(i => i.severity === 'critical').length;
    const warningCount = inlineResult.issues.filter(i => i.severity === 'warning').length;

    const lines = [`**${inlineResult.summary.status}** — ${inlineResult.summary.conclusion}`, '', '---', ''];

    if (strictMode) {
        const suggestionCount = inlineResult.issues.filter(i => i.severity === 'suggestion').length;
        lines.push(
            `| 🔴 Critical | ⚠️ Warning | 💡 Suggestion |`,
            `|:-----------:|:----------:|:-------------:|`,
            `| ${criticalCount} | ${warningCount} | ${suggestionCount} |`
        );
    } else {
        lines.push(
            `| 🔴 Critical | ⚠️ Warning |`,
            `|:-----------:|:----------:|`,
            `| ${criticalCount} | ${warningCount} |`
        );
    }

    if (inlineResult.issues.length > 0) {
        const totalIssues = inlineResult.issues.length;
        const fileCount = new Set(inlineResult.issues.slice(0, postedCount).map(i => i.file)).size;
        lines.push('', `_Inline comments posted for ${postedCount} issue(s) across ${fileCount} file(s) — check the Files Changed tab._`);
        if (totalIssues > postedCount) {
            lines.push(`_Note: ${totalIssues - postedCount} additional issue(s) exceeded the ${MAX_INLINE_COMMENTS} inline comment limit and were omitted._`);
        }
    }

    return lines;
}

/** groupByFile=true：同一檔案的所有 issues 合併為單一任務 */
function buildGroupedTasks(issues: InlineIssue[]): CommentTask[] {
    const fileGroups = new Map<string, InlineIssue[]>();
    for (const issue of issues) {
        const group = fileGroups.get(issue.file) ?? [];
        group.push(issue);
        fileGroups.set(issue.file, group);
    }

    return [...fileGroups.entries()].map(([filePath, grouped]) => {
        const lineStart = Math.min(...grouped.map(i => i.lineStart));
        const lineEnd = Math.max(...grouped.map(i => i.lineEnd));
        const lines: string[] = [];
        for (const issue of grouped) {
            lines.push(...formatIssueLines(issue), '');
        }
        return { filePath, lineStart, lineEnd, body: lines.join('\n').trimEnd() };
    });
}

/** groupByFile=false：每個 issue 各自一個任務 */
function buildIndividualTasks(issues: InlineIssue[]): CommentTask[] {
    return issues.map(issue => ({
        filePath: issue.file,
        lineStart: issue.lineStart,
        lineEnd: issue.lineEnd,
        body: formatIssueLines(issue).join('\n')
    }));
}

/**
 * 以行內評論模式將 AI 審查結果發佈至 PR
 * 先逐一發精準行號標註的行內評論，最後發摘要評論
 */
export async function addInlineReviewComments(
    devOpsService: DevOpsService,
    connection: DevOpsConnection,
    inlineResult: InlineReviewResult,
    providerName: string,
    aiModelName: string,
    groupByFile = true,
    strictMode = false
): Promise<void> {
    const issuesToPost = inlineResult.issues.slice(0, MAX_INLINE_COMMENTS);
    const summaryLines = buildSummaryLines(inlineResult, strictMode, issuesToPost.length);
    const tasks = groupByFile ? buildGroupedTasks(issuesToPost) : buildIndividualTasks(issuesToPost);

    let successCount = 0;
    for (const task of tasks) {
        try {
            await devOpsService.addInlinePullRequestComment(
                connection.projectName,
                connection.repositoryId,
                connection.pullRequestId,
                task.filePath,
                task.lineStart,
                task.lineEnd,
                task.body
            );
            successCount++;
        } catch (error) {
            console.warn(`⚠️ Skipped inline comment for ${task.filePath}:${task.lineStart}-${task.lineEnd} — ${(error as Error).message}`);
        }
    }

    console.log(`✅ Posted ${successCount}/${tasks.length} inline comments (covering ${issuesToPost.length} issue(s), groupByFile=${groupByFile})`);
    if (inlineResult.issues.length > MAX_INLINE_COMMENTS) {
        console.log(`ℹ️ ${inlineResult.issues.length - MAX_INLINE_COMMENTS} issue(s) were omitted (exceeded ${MAX_INLINE_COMMENTS} inline comment limit) — noted in summary comment`);
    }

    // 最後發摘要評論
    const commentHeader = `🤖 AI Code Review (${providerName} - ${aiModelName})`;
    await devOpsService.addPullRequestComment(
        connection.projectName,
        connection.repositoryId,
        connection.pullRequestId,
        summaryLines.join('\n'),
        commentHeader
    );
    console.log('✅ Summary comment posted');
}
