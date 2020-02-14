# DharmaDaiSubgraph
Files for Dharma Dai Subgraph on The Graph.

```
git clone https://github.com/0age/DharmaDaiSubgraph && cd DharmaDaiSubgraph
yarn global add @graphprotocol/graph-cli
yarn install
yarn build
graph auth https://api.thegraph.com/deploy/ <ACCESS_TOKEN>
yarn deploy # once you have the api key
yarn codegen # after any changes
```
