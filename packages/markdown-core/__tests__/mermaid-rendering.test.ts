import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderMarkdownAsync } from '../src/renderer';

const MERMAID_SAMPLE_MARKDOWN = `# システム構成図サンプル

以下は Mermaid を Markdown 内に埋め込む基本例です。

\`\`\`mermaid
flowchart TD
    A[ユーザー] --> B[Webアプリ]
    B --> C[APIサーバ]
    C --> D[(Database)]
\`\`\`

---

# シーケンス図

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend

    U->>F: ログイン
    F->>B: 認証API呼び出し
    B-->>F: JWT返却
    F-->>U: ログイン成功表示
\`\`\`

---

# クラス図

\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String name
        +login()
    }

    class Order {
        +String orderId
        +create()
    }

    User --> Order
\`\`\`

---

# 状態遷移図

\`\`\`mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review
    Review --> Approved
    Review --> Rejected
    Approved --> [*]
\`\`\`

---

# ガントチャート

\`\`\`mermaid
gantt
    title 開発スケジュール
    dateFormat  YYYY-MM-DD

    section 設計
    要件定義           :done, a1, 2026-05-01, 3d
    基本設計           :active, a2, 2026-05-04, 5d

    section 実装
    API開発            :2026-05-09, 7d
    フロント開発       :2026-05-10, 10d
\`\`\`

---

# ER図

\`\`\`mermaid
erDiagram
    USER ||--o{ ORDER : places

    USER {
        string id
        string name
    }

    ORDER {
        string id
        date created_at
    }
\`\`\``;

describe('renderMarkdownAsync mermaid integration', () => {
  beforeEach(() => {
        // Force runtime-missing path.
    delete (globalThis as { mermaid?: unknown }).mermaid;
  });

    it('converts all mermaid code fences to local runtime-missing error blocks', async () => {
    const html = await renderMarkdownAsync(MERMAID_SAMPLE_MARKDOWN);

    expect(html).not.toContain('<code class="language-mermaid">');

        const errors = html.match(/class="mermaid-error"/g) || [];
        const externalImages = html.match(/https:\/\/mermaid\.ink\/img\//g) || [];

        expect(errors).toHaveLength(6);
        expect(externalImages).toHaveLength(0);
  });

  it('keeps markdown sections while converting mermaid blocks', async () => {
    const html = await renderMarkdownAsync(MERMAID_SAMPLE_MARKDOWN);

    expect(html).toContain('システム構成図サンプル');
    expect(html).toContain('シーケンス図');
    expect(html).toContain('クラス図');
    expect(html).toContain('状態遷移図');
    expect(html).toContain('ガントチャート');
    expect(html).toContain('ER図');
  });

    it('uses window mermaid runtime when globalThis mermaid is missing', async () => {
        const initialize = vi.fn();
        const render = vi.fn().mockResolvedValue({ svg: '<svg><g></g></svg>' });
        const previousWindow = (globalThis as { window?: unknown }).window;

        (globalThis as { window?: { mermaid: { initialize: typeof initialize; render: typeof render } } }).window = {
            mermaid: { initialize, render }
        };

        try {
            const html = await renderMarkdownAsync('```mermaid\nflowchart TD\nA --> B\n```');
            expect(render).toHaveBeenCalledTimes(1);
            expect(html).toContain('class="mermaid-wrapper"');
            expect(html).not.toContain('class="mermaid-error"');
        } finally {
            if (previousWindow === undefined) {
                delete (globalThis as { window?: unknown }).window;
            } else {
                (globalThis as { window?: unknown }).window = previousWindow;
            }
        }
    });
});
