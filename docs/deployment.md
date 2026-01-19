# Deployment

## YAML Validation

Validate workflow files before pushing:
```bash
node -e "const yaml = require('yaml'); yaml.parse(require('fs').readFileSync('.github/workflows/deploy.yml', 'utf8'))"
```
