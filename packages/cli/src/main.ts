const help = `ZXCode — 1982 BASIC. 2026 developer experience.

Usage: zxcode [--help | -h | help]

Options:
  --help, -h   Show this help

The implementation skeleton currently provides help only.
BASIC check/build commands will be added in M1-10.
`;

const args = process.argv.slice(2);
const command = args[0];
if (args.length === 0 || (args.length === 1 && command !== undefined && ["--help", "-h", "help"].includes(command))) {
  process.stdout.write(help);
} else {
  process.stderr.write("Unsupported arguments. Run zxcode --help for usage.\n");
  process.exitCode = 1;
}
