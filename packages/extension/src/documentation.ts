import * as vscode from "vscode";
import type { LanguageDocumentation } from "@zxcode/core";
import { LANGUAGE_ID } from "./language.js";
export function toEditorDocumentation(documentation: LanguageDocumentation): vscode.MarkdownString {
  const result = new vscode.MarkdownString();
  result.isTrusted = false;
  result.supportHtml = false;
  result.appendText(documentation.summary);
  for (const syntax of documentation.syntax ?? []) result.appendCodeblock(syntax, LANGUAGE_ID);
  for (const remark of documentation.remarks ?? []) result.appendMarkdown("\n\n").appendText(remark);
  for (const link of documentation.links ?? []) {
    const url = new URL(link.url);
    if (url.protocol === "https:") result.appendMarkdown("\n\n").appendText(link.label).appendMarkdown(`: <${url.href}>`);
  }
  return result;
}
