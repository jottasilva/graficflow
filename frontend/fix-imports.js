const fs = require('fs');
let s = fs.readFileSync('src/components/graphflow-app.tsx', 'utf8');
s = s.replace('import {\r\n  LandingPageConfig, \r\n  AlertTriangle,', 'import {\r\n  AlertTriangle,');
s = s.replace('import { LandingPageConfig, \r\n  AlertTriangle,', 'import {\r\n  AlertTriangle,');
s = s.replace('import {\n  LandingPageConfig, \n  AlertTriangle,', 'import {\n  AlertTriangle,');
s = s.replace('import { LandingPageConfig, \n  AlertTriangle,', 'import {\n  AlertTriangle,');
s = s.replace('} from "../lib/graphflow-data";', ', LandingPageConfig } from "../lib/graphflow-data";');
fs.writeFileSync('src/components/graphflow-app.tsx', s, 'utf8');
