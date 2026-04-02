export type SelectorType = "css" | "xpath";
export type CollectionType = "single" | "list";

export interface SelectedElementInfo {
  tag?: string;
  text?: string;
  cssSelector?: string | null;
  xpath?: string | null;
  attributes?: Record<string, string>;
  message?: string;
}

export interface SelectorCandidate {
  type: SelectorType;
  value: string;
  source: string;
}

export interface ScrapingStrategy {
  intent: string;
  collectionType: CollectionType;
  primarySelector: {
    type: SelectorType;
    value: string;
    confidence?: number;
    reason: string;
  };
  fallbackSelectors: Array<{
    type: SelectorType;
    value: string;
    confidence?: number;
    reason: string;
  }>;
  extract: {
    attribute: string;
    target: "text" | "attribute" | "html";
    transform: string[];
  };
  waitFor: {
    type: "selector" | "timeout";
    value?: string;
    timeoutMs: number;
  };
}

export interface SessionResponse {
  sessionId: string;
  viewport: {
    width: number;
    height: number;
  };
}

export interface ScriptRequestBody {
  url: string;
  clickedElement: SelectedElementInfo;
}
