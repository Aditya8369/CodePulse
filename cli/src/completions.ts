export function generateShellCompletions(shell: 'bash' | 'zsh' | 'fish'): string {
  switch (shell) {
    case 'bash':
      return `
# CodePulse CLI bash completion
_codepulse_completions() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  opts="login logout battle test status config completion --help --version"

  case "\${prev}" in
    battle)
      COMPREPLY=( $(compgen -W "--queue --language --rank --editor" -- \${cur}) )
      return 0
      ;;
    test)
      COMPREPLY=( $(compgen -W "--challenge --file --lang --watch" -- \${cur}) )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- \${cur}) )
      return 0
      ;;
    *)
      ;;
  esac

  COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
  return 0
}
complete -F _codepulse_completions codepulse
`;

    case 'zsh':
      return `
#compdef codepulse
_codepulse() {
  local -a commands
  commands=(
    'login:Authenticate terminal via GitHub OAuth Device Code Flow'
    'logout:Revoke and clear stored credentials'
    'battle:Join coding battle queue and launch terminal editor'
    'test:Execute local test suites against challenge'
    'status:Check active ratings, ranks and battle telemetry'
    'completion:Generate shell completion scripts'
  )
  _describe 'command' commands
}
_codepulse "$@"
`;

    case 'fish':
      return `
# CodePulse fish completion
complete -c codepulse -n "__fish_use_subcommand" -a login -d "Authenticate via GitHub OAuth"
complete -c codepulse -n "__fish_use_subcommand" -a logout -d "Clear cached session"
complete -c codepulse -n "__fish_use_subcommand" -a battle -d "Launch live terminal coding battle"
complete -c codepulse -n "__fish_use_subcommand" -a test -d "Run challenge test suite locally"
complete -c codepulse -n "__fish_use_subcommand" -a status -d "View platform rank and MMR"
complete -c codepulse -n "__fish_use_subcommand" -a completion -d "Output shell completion"
`;
  }
}
