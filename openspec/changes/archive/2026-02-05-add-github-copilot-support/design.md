# 架構設計文件

> 本文件說明 GitHub Copilot CLI Server 整合的架構設計、技術決策和權衡考量。

## 目錄
1. [系統概覽](#系統概覽)
2. [架構決策](#架構決策)
3. [元件設計](#元件設計)
4. [資料流程](#資料流程)
5. [錯誤處理策略](#錯誤處理策略)
6. [效能考量](#效能考量)
7. [安全性考量](#安全性考量)
8. [未來擴充性](#未來擴充性)

---

## 系統概覽

### 整體架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure DevOps Pipeline                     │
│                                                               │
│  ┌─────────────────┐                                        │
│  │   task.json     │ ← 使用者透過 UI 設定                   │
│  │   UI Inputs     │   - AI Provider: GitHub Copilot        │
│  └────────┬────────┘   - Network Type: Intranet             │
│           │            - Server Address: 192.168.1.100:8080 │
│           ↓                                                   │
│  ┌─────────────────┐                                        │
│  │   index.ts      │ ← Pipeline Task 主程式                 │
│  │   Main Entry    │                                        │
│  └────────┬────────┘                                        │
│           │                                                   │
│           ↓                                                   │
│  ┌─────────────────────────────┐                            │
│  │   AIProviderService         │ ← Provider 工廠            │
│  │   (Factory Pattern)         │                            │
│  └──────────┬──────────────────┘                            │
│             │                                                 │
│             ↓                                                 │
│  ┌─────────────────────────────┐                            │
│  │   GithubCopilotService      │ ← 新增的服務實作           │
│  │   implements AIService      │                            │
│  └──────────┬──────────────────┘                            │
│             │                                                 │
└─────────────┼─────────────────────────────────────────────────┘
              │
              │ @github/copilot-sdk
              │ JSON-RPC over network
              ↓
┌─────────────────────────────────────────────────────────────┐
│            Internal Network / Corporate LAN                  │
│                                                               │
│  ┌─────────────────────────────┐                            │
│  │   GitHub Copilot CLI        │ ← 企業內部部署             │
│  │   Server (host:port)        │                            │
│  └──────────┬──────────────────┘                            │
│             │                                                 │
│             ↓                                                 │
│  ┌─────────────────────────────┐                            │
│  │   AI Model (gpt-5-mini, etc)    │                            │
│  └─────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 系統邊界
- **內部**：AI-PR-AutoReview Extension（Task、Service Layer）
- **外部**：GitHub Copilot CLI Server（企業內部部署）
- **介面**：@github/copilot-sdk（JSON-RPC）

---

## 架構決策

### ADR-001: GithubCopilotService 不繼承 BaseAIService

#### 決策
GithubCopilotService **直接實作 AIService 介面**，不繼承 BaseAIService。

#### 情境
現有的四個 AI Providers（Google、OpenAI、Grok、Claude）都繼承自 BaseAIService，該基礎類別提供：
- API Key 驗證（constructor 中強制非空）
- 共用日誌方法（logGenerationStart、printRequestInfo、printResponseInfo）

但 GitHub Copilot CLI Server 的特殊性：
- **不需要 API Key**（認證由 CLI Server 處理）
- 使用專用 SDK（@github/copilot-sdk）而非 HTTP 或 OpenAI SDK

#### 考慮的替代方案

**方案 A：繼承 BaseAIService + 繞過驗證**
```typescript
// 傳入特殊標記繞過驗證
super('MANAGED_BY_SERVER', model);
```

**優點**：
- 重用 BaseAIService 的共用方法
- 最少程式碼變更

**缺點**：
- ❌ 程式碼意圖不清晰（API Key 為 'MANAGED_BY_SERVER' 看起來像 hack）
- ❌ 未來維護者可能困惑
- ❌ 違反 Liskov Substitution Principle（子類別行為與父類別預期不一致）

**方案 B：修改 BaseAIService 使 apiKey 可選**
```typescript
constructor(apiKey?: string, model: string) {
    if (apiKey && apiKey.trim() === '') {
        throw new Error(...);
    }
    this.apiKey = apiKey || '';
    this.model = model;
}
```

**優點**：
- 未來其他無需 API Key 的 Provider 可直接使用
- 架構更靈活

**缺點**：
- ❌ 影響現有四個 Providers（需要完整回歸測試）
- ❌ BaseAIService 的語意變得模糊（apiKey 可有可無）
- ❌ 每個繼承類別都需要檢查 apiKey 是否存在

**方案 C：直接實作 AIService 介面（✅ 已採用）**
```typescript
export class GithubCopilotService implements AIService {
    private serverAddress: string;
    private model: string;
    // 不需要 apiKey 欄位

    constructor(serverAddress: string, model: string = 'gpt-5-mini') {
        // 驗證 serverAddress
    }
}
```

**優點**：
- ✅ 程式碼意圖清晰（明確表達不需要 API Key）
- ✅ 職責分離（不依賴 BaseAIService 的實作細節）
- ✅ 不影響現有 Providers（零風險）
- ✅ 未來如需修改 BaseAIService，不會影響 GitHub Copilot

**缺點**：
- ⚠️ 需要重新實作共用方法（printRequestInfo、printResponseInfo）
- ⚠️ 約增加 50 行程式碼

#### 決策結論
✅ **採用方案 C**

#### 理由
1. **清晰性 > 程式碼重用**：多 50 行程式碼的代價遠小於未來維護困惑的成本
2. **隔離變化**：GitHub Copilot 的特殊性（SDK、連接方式）都與其他 Providers 不同
3. **最小影響原則**：不影響現有穩定的程式碼

#### 實作細節
- 複製參考 BaseAIService 的共用方法（保持日誌格式一致）
- 調整 printRequestInfo 以包含 Server 位址而非 API Key

---

### ADR-002: 使用 @github/copilot-sdk 而非自行實作 JSON-RPC

#### 決策
使用官方 `@github/copilot-sdk` 套件連接 CLI Server，而非自行實作 JSON-RPC 通訊。

#### 情境
需要與 GitHub Copilot CLI Server 通訊，該 Server 使用 JSON-RPC 協定。

#### 考慮的替代方案

**方案 A：自行實作 JSON-RPC Client**
使用 axios 或 fetch 直接發送 JSON-RPC 請求。

**優點**：
- 無額外依賴
- 完全控制通訊細節

**缺點**：
- ❌ 需要實作 JSON-RPC 2.0 協定（複雜）
- ❌ 需要處理連接管理、錯誤處理、重試邏輯
- ❌ 未來 Copilot Server 協定變更需要手動更新
- ❌ 無法利用官方 SDK 的最佳實踐

**方案 B：使用 @github/copilot-sdk（✅ 已採用）**

**優點**：
- ✅ 官方支援，符合最佳實踐
- ✅ SDK 自動處理 JSON-RPC 通訊複雜性
- ✅ 自動管理連接生命週期
- ✅ 未來協定變更透過 SDK 更新處理
- ✅ 提供 TypeScript 型別定義

**缺點**：
- ⚠️ SDK 處於 Technical Preview 階段，API 可能變動
- ⚠️ 新增外部依賴（約 X MB，需確認）

#### 決策結論
✅ **採用方案 B**

#### 風險緩解
1. **API 變動風險**：
   - 設計彈性介面，將 SDK 依賴限制在 GithubCopilotService 內部
   - 使用 adapter 模式，便於未來切換實作

2. **版本鎖定**：
   - 在 package.json 中鎖定 SDK 版本（使用 `~` 或精確版本）
   - 定期檢查 SDK 更新和 breaking changes

---

### ADR-003: 延遲初始化 Client 連接

#### 決策
在首次呼叫 `generateComment()` 時才建立 Copilot Client 連接，而非在 constructor 中。

#### 情境
何時建立與 CLI Server 的連接？

#### 考慮的替代方案

**方案 A：Constructor 中立即初始化**
```typescript
constructor(serverAddress: string, model: string) {
    this.serverAddress = serverAddress;
    this.model = model;
    this.initializeClient();  // 同步或異步？
}
```

**優點**：
- 簡單直接

**缺點**：
- ❌ Constructor 不應包含異步操作（TypeScript 限制）
- ❌ 如果連接失敗，物件建立失敗，錯誤處理複雜
- ❌ 即使不使用服務，也會建立連接（浪費資源）

**方案 B：延遲初始化（✅ 已採用）**
```typescript
constructor(serverAddress: string, model: string) {
    this.serverAddress = serverAddress;
    this.model = model;
    // 不建立連接
}

public async generateComment(...) {
    await this.initializeClient();  // 首次呼叫時才連接
    // ...
}
```

**優點**：
- ✅ Constructor 保持同步和輕量
- ✅ 只在需要時才建立連接
- ✅ 錯誤處理更清晰（在 generateComment 中拋出）
- ✅ 符合現有 Providers 的模式

**缺點**：
- ⚠️ 首次請求稍慢（需建立連接）

#### 決策結論
✅ **採用方案 B**

#### 實作細節
```typescript
private async initializeClient(): Promise<void> {
    if (this.client) return;  // 已初始化，直接返回

    try {
        const { CopilotClient } = await import('@github/copilot-sdk');
        const [host, port] = this.parseServerAddress(this.serverAddress);

        this.client = new CopilotClient({
            server: { host, port: parseInt(port) }
        });

        console.log(`✅ Connected to GitHub Copilot CLI Server at ${this.serverAddress}`);
    } catch (error: any) {
        throw new Error(`⛔ Failed to initialize GitHub Copilot Client: ${error.message}`);
    }
}
```

---

## 元件設計

### GithubCopilotService 類別結構

```typescript
export class GithubCopilotService implements AIService {
    // ===== 狀態 =====
    private serverAddress: string;      // 例如 "192.168.1.100:8080"
    private model: string;               // 例如 "gpt-5-mini"
    private client: CopilotClient;       // SDK Client 實例

    // ===== 公開方法 =====
    constructor(serverAddress: string, model: string)
    async generateComment(systemInstruction: string, prompt: string, config?: GenerateConfig): Promise<AIResponse>
    async dispose(): Promise<void>

    // ===== 私有方法 =====
    private async initializeClient(): Promise<void>
    private parseServerAddress(address: string): [string, string]
    private extractTokenUsage(response: any): { inputTokens?: number; outputTokens?: number }
    private estimateTokenUsage(response: any): { inputTokens?: number; outputTokens?: number }
    private printRequestInfo(systemInstruction: string, prompt: string, config: GenerateConfig): void
    private printResponseInfo(content: string): void
}
```

### 狀態機：Client 連接狀態

```
┌──────────────┐
│ Constructed  │ ← constructor() 完成
└──────┬───────┘
       │
       │ generateComment() 首次呼叫
       │
       ↓
┌──────────────┐
│ Connecting   │ ← initializeClient() 執行中
└──────┬───────┘
       │
       ├─ 成功 ───→ ┌──────────────┐
       │            │  Connected   │ ← client 已建立
       │            └──────────────┘
       │
       └─ 失敗 ───→ ┌──────────────┐
                    │    Error     │ ← 拋出例外
                    └──────────────┘
```

---

## 資料流程

### 端到端流程：從使用者設定到 PR 評論

```
1️⃣ 使用者在 Azure DevOps Pipeline 設定 Task
   ↓
   - AI Provider: GitHub Copilot
   - Network Type: Intranet
   - Server Address: 192.168.1.100:8080

2️⃣ Pipeline 執行，index.ts 讀取輸入
   ↓
   inputs = {
       aiProvider: 'GitHubCopilot',
       serverAddress: '192.168.1.100:8080',
       modelName: 'gpt-5-mini',
       ...
   }

3️⃣ 註冊服務到 AIProviderService
   ↓
   aiProvider.registerService('GitHubCopilot', {
       serverAddress: '192.168.1.100:8080',
       modelName: 'gpt-5-mini'
   })

4️⃣ 建立服務實例（工廠模式）
   ↓
   service = new GithubCopilotService('192.168.1.100:8080', 'gpt-5-mini')

5️⃣ 取得 PR 差異
   ↓
   fileChanges = devOpsService.getPullRequestChanges()

6️⃣ 生成 AI 評論
   ↓
   response = await service.generateComment(
       systemInstruction,
       formattedPrompt,
       config
   )

   6.1 首次呼叫：initializeClient()
       ↓
       - 動態引入 @github/copilot-sdk
       - 解析 serverAddress (host, port)
       - new CopilotClient({ server: { host, port } })

   6.2 建立 Session
       ↓
       session = await client.createSession({
           model: 'gpt-5-mini',
           systemMessage: systemInstruction,
           temperature: 1.0,
           maxTokens: 4096
       })

   6.3 發送 Prompt
       ↓
       response = await session.sendAndWait({ prompt: formattedPrompt })

   6.4 提取回應和 Token Usage
       ↓
       return {
           content: response.data.content,
           inputTokens: usage.inputTokens,
           outputTokens: usage.outputTokens
       }

7️⃣ 發佈評論到 PR
   ↓
   devOpsService.addReviewComment(response.content)

8️⃣ 完成
```

### 錯誤路徑

```
任何階段發生錯誤
   ↓
   catch (error)
   ↓
   throw new Error('⛔ GitHub Copilot service error: ' + error.message)
   ↓
   index.ts 捕獲並記錄
   ↓
   Pipeline 任務失敗，顯示錯誤訊息
```

---

## 錯誤處理策略

### 錯誤分類與處理

#### 1. 設定錯誤（Configuration Errors）
**發生時機**：Constructor 或參數驗證

**範例**：
- Server address 格式錯誤（缺少 port）
- 空的 server address

**處理**：
```typescript
if (!serverAddress || serverAddress.trim() === '') {
    throw new Error('⛔ Server address is required for GitHub Copilot');
}

const parts = address.split(':');
if (parts.length !== 2) {
    throw new Error(`⛔ Invalid server address format: ${address}. Expected format: host:port`);
}
```

**使用者體驗**：Pipeline 立即失敗，顯示清晰錯誤訊息

---

#### 2. 連接錯誤（Connection Errors）
**發生時機**：initializeClient()

**範例**：
- Server 不存在或無法連接
- 網路逾時
- 防火牆阻擋

**處理**：
```typescript
try {
    this.client = new CopilotClient({ server: { host, port } });
    console.log(`✅ Connected to GitHub Copilot CLI Server at ${this.serverAddress}`);
} catch (error: any) {
    throw new Error(`⛔ Failed to connect to CLI Server at ${this.serverAddress}: ${error.message}`);
}
```

**使用者體驗**：
- 顯示無法連接的錯誤
- 建議檢查網路和防火牆設定

---

#### 3. SDK 錯誤（SDK Errors）
**發生時機**：SDK 操作（createSession、sendAndWait）

**範例**：
- SDK API 變更
- Server 回應格式不符預期
- Session 建立失敗

**處理**：
```typescript
try {
    const session = await this.client.createSession({ model, systemMessage, ... });
    const response = await session.sendAndWait({ prompt });
    return this.extractResponse(response);
} catch (error: any) {
    throw new Error(`⛔ GitHub Copilot SDK error: ${error.message}`);
}
```

**緩解**：
- 彈性的回應解析（嘗試多種可能的欄位名稱）
- 詳細的錯誤日誌

---

#### 4. 回應錯誤（Response Errors）
**發生時機**：回應內容提取

**範例**：
- 空回應
- 格式不符預期
- Token usage 資訊缺失

**處理**：
```typescript
const content = response?.data?.content || 'No response generated';

// Token usage 優雅降級
const usage = response?.usage || response?.data?.usage;
if (!usage) {
    return this.estimateTokenUsage(response);  // 使用估算
}
```

**使用者體驗**：
- 仍能取得評論內容（如果有）
- Token usage 顯示為估算值或 N/A

---

### 錯誤訊息規範

所有錯誤訊息遵循以下格式：
```
⛔ [Component] [Error Type]: [Detailed Message]
```

**範例**：
- `⛔ Server address is required for GitHub Copilot`
- `⛔ Invalid server address format: abc. Expected format: host:port`
- `⛔ Failed to connect to CLI Server at 192.168.1.100:8080: Connection refused`
- `⛔ GitHub Copilot SDK error: Session creation failed`

**原則**：
- 使用 emoji ⛔ 標記錯誤
- 包含足夠的 context（如 server address）
- 提供可行的建議（如預期格式）

---

## 效能考量

### 連接開銷
- **首次請求**：需建立 TCP 連接到 CLI Server（約 100-500ms）
- **後續請求**：重用已建立連接（<50ms overhead）

### 記憶體使用
- **CopilotClient 實例**：約 X MB（待實測確認）
- **Session 資料**：每個 session 約 Y KB（取決於 prompt 和 response 大小）

### 網路頻寬
- **上傳**：System instruction + Prompt（通常 10-50 KB）
- **下載**：Response content（通常 5-20 KB）

### 優化策略
1. **連接重用**：Client 實例在服務生命週期中保持
2. **延遲初始化**：不使用時不建立連接
3. **避免重複連接**：`if (this.client) return` 檢查

---

## 安全性考量

### 1. 網路通訊
**風險**：中間人攻擊（MITM）

**緩解**：
- 建議使用者配置 HTTPS/TLS 連接（如果 CLI Server 支援）
- 在文檔中說明網路安全最佳實踐

### 2. Server Address 驗證
**風險**：注入攻擊（雖然風險較低）

**緩解**：
- 嚴格驗證 address 格式（必須是 `host:port`）
- 不執行任何 eval 或動態程式碼

### 3. 敏感資訊
**風險**：Server address 可能包含敏感資訊

**緩解**：
- 不在日誌中完整輸出 server address（僅在連接成功時顯示）
- 錯誤訊息中謹慎處理

### 4. SDK 安全性
**依賴**：@github/copilot-sdk 的安全性

**緩解**：
- 使用官方套件（npm）
- 定期更新 SDK 版本
- 使用 npm audit 檢查漏洞

---

## 未來擴充性

### Phase 2：網際網路模式

#### 目標
支援透過 MCP Server 連接雲端 GitHub Copilot。

#### 架構變更
```typescript
// 新增連接模式介面
enum ConnectionMode {
    Intranet = 'intranet',
    Internet = 'internet'
}

// 修改 constructor
constructor(
    config: {
        mode: ConnectionMode;
        serverAddress?: string;      // Intranet 模式使用
        mcpServerUrl?: string;       // Internet 模式使用
        authToken?: string;          // Internet 模式使用
    },
    model: string
) {
    // 根據 mode 選擇連接策略
}
```

#### 實作策略
使用 **策略模式（Strategy Pattern）**：

```typescript
interface ConnectionStrategy {
    connect(): Promise<CopilotClient>;
}

class IntranetConnectionStrategy implements ConnectionStrategy {
    async connect(): Promise<CopilotClient> {
        // 現有實作
    }
}

class InternetConnectionStrategy implements ConnectionStrategy {
    async connect(): Promise<CopilotClient> {
        // MCP Server 連接邏輯
    }
}
```

---

### Phase 3：多 Server 負載平衡

#### 目標
支援多個 CLI Server 以提高可用性和效能。

#### 架構變更
```typescript
constructor(
    serverAddresses: string[],  // 多個 server
    model: string
) {
    this.serverPool = serverAddresses;
    this.currentServerIndex = 0;
}

private async connectWithFailover(): Promise<void> {
    for (const address of this.serverPool) {
        try {
            await this.connectToServer(address);
            return;  // 成功
        } catch (error) {
            console.warn(`⚠️ Failed to connect to ${address}, trying next...`);
        }
    }
    throw new Error('⛔ All servers unavailable');
}
```

---

### Phase 4：健康檢查

#### 目標
定期檢查 CLI Server 可用性，提前發現問題。

#### 實作
```typescript
private async healthCheck(): Promise<boolean> {
    try {
        const response = await this.client.ping();
        return response.ok;
    } catch {
        return false;
    }
}

// 在 generateComment 前檢查
public async generateComment(...) {
    if (!await this.healthCheck()) {
        await this.reconnect();
    }
    // ...
}
```

---

## 設計模式總結

### 已使用的設計模式

1. **工廠模式（Factory Pattern）**
   - `AIProviderService.getService()` 根據 provider 名稱建立對應實例

2. **策略模式（Strategy Pattern）**
   - 不同 AI Providers 實作相同介面（AIService）
   - 可動態切換 Provider

3. **介面隔離原則（Interface Segregation）**
   - GithubCopilotService 僅實作 AIService，不依賴 BaseAIService

### 未來可使用的模式

1. **策略模式（Phase 2）**
   - 不同連接模式（Intranet vs Internet）

2. **代理模式（Proxy Pattern）**
   - 連接池管理、快取

3. **觀察者模式（Observer Pattern）**
   - Server 健康狀態通知

---

## 技術債務與已知限制

### 技術債務
1. **共用方法重複**：printRequestInfo、printResponseInfo 複製自 BaseAIService
   - **影響**：維護成本略增
   - **緩解**：保持格式一致，降低維護難度

2. **SDK API 不確定性**：基於文檔推測，實測可能需調整
   - **影響**：首次實作可能需要迭代
   - **緩解**：設計彈性介面，便於調整

### 已知限制
1. **SDK Technical Preview**：API 可能變動
2. **僅支援內部網路模式**：網際網路模式需 Phase 2
3. **Token usage 可能不準確**：取決於 SDK 是否提供

---

## 參考資料
- [GitHub Copilot SDK Repository](https://github.com/github/copilot-sdk)
- [Design Patterns: Factory Pattern](https://refactoring.guru/design-patterns/factory-method)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- 專案計劃：`C:\Users\lawrence\.claude\plans\iridescent-growing-hennessy.md`
