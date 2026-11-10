// Medusa 2.21 supports only LTS (22.22+ or 24). Node 25+ breaks parts of the toolchain.
const [major, minor] = process.versions.node.split('.').map(Number)
const supported = (major === 22 && minor >= 22) || major === 24

if (!supported) {
  console.error(
    `medusa-libs requires Node 22.22+ or 24 LTS (current: v${process.versions.node}). Run: nvm use`,
  )
  process.exit(1)
}
