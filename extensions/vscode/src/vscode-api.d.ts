declare module 'vscode' {
  export interface Disposable {
    dispose(): unknown;
  }

  export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
  }

  export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
  }

  export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
  }

  export interface Command {
    title: string;
    command: string;
    tooltip?: string;
    arguments?: unknown[];
  }

  export class ThemeIcon {
    constructor(readonly id: string);
  }

  export class TreeItem {
    label?: string;
    description?: string;
    tooltip?: string;
    contextValue?: string;
    iconPath?: ThemeIcon;
    command?: Command;
    constructor(
      label: string,
      collapsibleState?: TreeItemCollapsibleState,
    );
  }

  export class EventEmitter<T> {
    readonly event: (listener: (e: T) => unknown) => Disposable;
    fire(data?: T): void;
    dispose(): void;
  }

  export interface TreeDataProvider<T> {
    onDidChangeTreeData?: (listener: (e: T | undefined | null | void) => unknown) => Disposable;
    getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
    getChildren(element?: T): T[] | Thenable<T[]>;
  }

  export class Position {
    constructor(readonly line: number, readonly character: number);
  }

  export class Range {
    constructor(readonly start: Position, readonly end: Position);
  }

  export interface DecorationOptions {
    range: Range;
    hoverMessage?: string;
    renderOptions?: {
      after?: {
        contentText?: string;
        color?: string;
        margin?: string;
      };
    };
  }

  export interface TextEditorDecorationType extends Disposable {
    readonly key: string;
  }

  export interface TextDocument {
    readonly uri: { fsPath: string; toString(): string };
    readonly languageId: string;
    readonly version: number;
    getText(): string;
  }

  export interface TextEditor {
    readonly document: TextDocument;
    setDecorations(
      decorationType: TextEditorDecorationType,
      rangesOrOptions: readonly DecorationOptions[],
    ): void;
  }

  export interface TextDocumentChangeEvent {
    readonly document: TextDocument;
    readonly contentChanges: ReadonlyArray<{
      readonly rangeOffset: number;
      readonly rangeLength: number;
      readonly text: string;
    }>;
  }

  export interface StatusBarItem extends Disposable {
    text: string;
    tooltip?: string;
    command?: string;
    show(): void;
    hide(): void;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
    readonly globalStorageUri?: { fsPath: string };
  }

  export namespace window {
    export let activeTextEditor: TextEditor | undefined;
    export function registerTreeDataProvider<T>(
      viewId: string,
      treeDataProvider: TreeDataProvider<T>,
    ): Disposable;
    export function createStatusBarItem(
      alignment?: StatusBarAlignment,
      priority?: number,
    ): StatusBarItem;
    export function createTextEditorDecorationType(options: {
      isWholeLine?: boolean;
      backgroundColor?: string;
      overviewRulerColor?: string;
      after?: { color?: string; margin?: string };
    }): TextEditorDecorationType;
    export function showTextDocument(
      document: TextDocument,
      column?: ViewColumn,
      preserveFocus?: boolean,
    ): Thenable<TextEditor>;
    export function showInformationMessage(message: string): Thenable<string | undefined>;
    export function showWarningMessage(message: string): Thenable<string | undefined>;
    export function showErrorMessage(message: string): Thenable<string | undefined>;
  }

  export namespace workspace {
    export function openTextDocument(options: {
      content?: string;
      language?: string;
    } | string): Thenable<TextDocument>;
    export function onDidChangeTextDocument(
      listener: (e: TextDocumentChangeEvent) => unknown,
    ): Disposable;
    export function getConfiguration(section?: string): {
      get<T>(key: string, defaultValue?: T): T;
    };
  }

  export namespace commands {
    export function registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown,
    ): Disposable;
  }
}

declare module '@vscode/test-electron' {
  export function runTests(options: {
    extensionDevelopmentPath: string;
    extensionTestsPath: string;
    launchArgs?: string[];
  }): Promise<number>;
}
