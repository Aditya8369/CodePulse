import * as vscode from 'vscode';

export type ArenaSectionKind = 'challenges' | 'friends' | 'invites';

export interface ActiveChallengeItem {
  id: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  timeLimitSeconds: number;
  language: string;
  starterCode: string;
  problemMarkdown: string;
  testCases: Array<{
    id: string;
    name: string;
    input: string;
    expectedOutput: string;
    lineHint?: number;
  }>;
}

export interface OnlineFriendItem {
  id: string;
  username: string;
  rating: number;
  status: 'ONLINE' | 'IN_BATTLE';
}

export interface PendingBattleInviteItem {
  inviteId: string;
  battleId: string;
  challengerUsername: string;
  category: string;
  expiresInSeconds: number;
  challenge: ActiveChallengeItem;
}

export class ArenaTreeNode extends vscode.TreeItem {
  constructor(
    public readonly nodeId: string,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly kind: 'section' | 'challenge' | 'friend' | 'invite',
    public readonly sectionKind?: ArenaSectionKind,
    public readonly payload?:
      | ActiveChallengeItem
      | OnlineFriendItem
      | PendingBattleInviteItem,
  ) {
    super(label, collapsibleState);
  }
}

export class CodePulseBattleTreeProvider
  implements vscode.TreeDataProvider<ArenaTreeNode>
{
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<ArenaTreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private challenges: ActiveChallengeItem[] = [
    {
      id: 'chal-two-sum-stream',
      title: 'Two-Sum Sliding Stream',
      difficulty: 'MEDIUM',
      timeLimitSeconds: 900,
      language: 'typescript',
      starterCode: `export function solve(nums: number[], target: number): [number, number] {
  // Implement O(n) hash map lookup
  return [-1, -1];
}
`,
      problemMarkdown: `# Two-Sum Sliding Stream (MEDIUM)

Given an array of integers \`nums\` and an integer \`target\`, return the 0-based indices \`[i, j]\` such that \`nums[i] + nums[j] === target\`.

### Constraints
- \`2 <= nums.length <= 10^5\`
- Expected Time Complexity: **O(n)**

### Example
\`\`\`ts
solve([2, 7, 11, 15], 9) // => [0, 1]
\`\`\`
`,
      testCases: [
        {
          id: 'tc-1',
          name: 'Basic pair [2, 7, 11, 15], target=9',
          input: 'solve([2, 7, 11, 15], 9)',
          expectedOutput: '[0,1]',
          lineHint: 2,
        },
        {
          id: 'tc-2',
          name: 'Non-adjacent pair [3, 2, 4], target=6',
          input: 'solve([3, 2, 4], 6)',
          expectedOutput: '[1,2]',
          lineHint: 2,
        },
      ],
    },
    {
      id: 'chal-lru-cache',
      title: 'Lock-Free LRU Cache',
      difficulty: 'HARD',
      timeLimitSeconds: 1200,
      language: 'typescript',
      starterCode: `export function solve(capacity: number, ops: string[]): number[] {
  return [];
}
`,
      problemMarkdown: `# Lock-Free LRU Cache (HARD)\n\nDesign an O(1) Least Recently Used cache supporting \`get\` and \`put\`.\n`,
      testCases: [
        {
          id: 'tc-lru-1',
          name: 'Eviction order check',
          input: 'solve(2, ["put:1:1","put:2:2","get:1","put:3:3","get:2"])',
          expectedOutput: '[1,-1]',
          lineHint: 1,
        },
      ],
    },
  ];

  private friends: OnlineFriendItem[] = [
    { id: 'u-101', username: 'arjun_dev', rating: 1840, status: 'ONLINE' },
    { id: 'u-102', username: 'meera_codes', rating: 1925, status: 'IN_BATTLE' },
  ];

  private invites: PendingBattleInviteItem[] = [
    {
      inviteId: 'inv-501',
      battleId: 'battle-live-501',
      challengerUsername: 'arjun_dev',
      category: 'ALGORITHMS',
      expiresInSeconds: 180,
      challenge: this.challenges[0],
    },
  ];

  refresh(data?: {
    challenges?: ActiveChallengeItem[];
    friends?: OnlineFriendItem[];
    invites?: PendingBattleInviteItem[];
  }): void {
    if (data?.challenges) this.challenges = data.challenges;
    if (data?.friends) this.friends = data.friends;
    if (data?.invites) this.invites = data.invites;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getChallenges(): ActiveChallengeItem[] {
    return [...this.challenges];
  }

  getFriends(): OnlineFriendItem[] {
    return [...this.friends];
  }

  getPendingInvites(): PendingBattleInviteItem[] {
    return [...this.invites];
  }

  getTreeItem(element: ArenaTreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ArenaTreeNode): ArenaTreeNode[] {
    if (!element) {
      return [
        new ArenaTreeNode(
          'sec-invites',
          `Pending Battle Invites (${this.invites.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          'section',
          'invites',
        ),
        new ArenaTreeNode(
          'sec-challenges',
          `Active Challenges (${this.challenges.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          'section',
          'challenges',
        ),
        new ArenaTreeNode(
          'sec-friends',
          `Online Friends (${this.friends.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          'section',
          'friends',
        ),
      ];
    }

    if (element.kind === 'section' && element.sectionKind === 'invites') {
      return this.invites.map((inv) => {
        const node = new ArenaTreeNode(
          inv.inviteId,
          `vs @${inv.challengerUsername} — ${inv.challenge.title}`,
          vscode.TreeItemCollapsibleState.None,
          'invite',
          'invites',
          inv,
        );
        node.description = `${inv.category} • ${inv.expiresInSeconds}s`;
        node.tooltip = 'Click to accept battle invite and open split-screen workspace';
        node.iconPath = new vscode.ThemeIcon('flame');
        node.command = {
          title: 'Accept Battle Invite',
          command: 'codepulse.acceptInvite',
          arguments: [inv],
        };
        return node;
      });
    }

    if (element.kind === 'section' && element.sectionKind === 'challenges') {
      return this.challenges.map((chal) => {
        const node = new ArenaTreeNode(
          chal.id,
          chal.title,
          vscode.TreeItemCollapsibleState.None,
          'challenge',
          'challenges',
          chal,
        );
        node.description = `${chal.difficulty} • ${Math.floor(chal.timeLimitSeconds / 60)}m`;
        node.tooltip = 'Click to start coding match in split editor';
        node.iconPath = new vscode.ThemeIcon('code');
        node.command = {
          title: 'Start Coding Battle',
          command: 'codepulse.startBattle',
          arguments: [chal],
        };
        return node;
      });
    }

    if (element.kind === 'section' && element.sectionKind === 'friends') {
      return this.friends.map((friend) => {
        const node = new ArenaTreeNode(
          friend.id,
          `@${friend.username}`,
          vscode.TreeItemCollapsibleState.None,
          'friend',
          'friends',
          friend,
        );
        node.description = `${friend.rating} ELO • ${friend.status}`;
        node.iconPath = new vscode.ThemeIcon(
          friend.status === 'ONLINE' ? 'circle-filled' : 'sync',
        );
        return node;
      });
    }

    return [];
  }
}
