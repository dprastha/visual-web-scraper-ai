export interface SelectedElementInfo {
  tag?: string;
  text?: string;
  cssSelector?: string | null;
  xpath?: string | null;
  attributes?: Record<string, string>;
  message?: string;
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
  clickedElement: SelectedElementInfo | null;
}
