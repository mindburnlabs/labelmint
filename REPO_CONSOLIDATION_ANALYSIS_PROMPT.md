# Repository Duplication & Consolidation Analysis Prompt

## Agent Instructions
You are tasked with performing a comprehensive scan of the LabelMint repository to identify ALL types of duplications, consolidation opportunities, and refactoring potential. This analysis must be exhaustive and systematic.

## Primary Objectives

### 1. **Directory Structure Analysis**
- **Duplicate Directories**: Identify directories with similar names or purposes (e.g., `/test` vs `/tests`, `/k8s` vs `/infrastructure/k8s`)
- **Misplaced Files**: Find files that should be grouped together but are scattered across different locations
- **Empty Directories**: Catalog all empty directories that should be removed
- **Similar Directory Structures**: Identify directories that could be merged or standardized

### 2. **File-Level Duplications**
- **Exact Duplicates**: Files with identical content but different names/locations
- **Near Duplicates**: Files with 80%+ similarity that could be refactored
- **Configuration Files**: Similar configs across different services/apps
- **Documentation Files**: Duplicate README, contributing guides, etc.
- **Docker Files**: Similar Dockerfile patterns that could use multi-stage builds

### 3. **Code Duplications**

#### **Source Code Patterns**
- **Duplicate Functions**: Functions with similar logic implemented differently
- **Similar Classes/Interfaces**: Classes serving similar purposes with different implementations
- **Utility Functions**: Common utilities (validation, formatting, error handling) duplicated across packages
- **API Clients**: Similar HTTP client configurations and request patterns
- **Database Models**: Similar entity definitions or queries
- **Authentication/Authorization**: Duplicate auth logic across services

#### **Component Duplications**
- **React Components**: Similar UI components across different apps
- **Hooks**: Custom hooks with similar functionality
- **Types/Interfaces**: Duplicate TypeScript type definitions
- **Constants/Magic Numbers**: Hard-coded values that should be centralized

### 4. **Configuration Duplications**
- **Package.json Files**: Duplicate dependencies, scripts, or configurations
- **TypeScript Configs**: Similar compiler options, path mappings, or includes/excludes
- **ESLint/Prettier Configs**: Duplicate or conflicting linting rules
- **Environment Files**: Similar environment variables that could be standardized
- **Docker Compose Files**: Similar service definitions, networks, or volumes

### 5. **Build & Deployment Duplications**
- **CI/CD Workflows**: Similar GitHub Actions or workflow patterns
- **Build Scripts**: Duplicate build configurations across packages
- **Docker Configurations**: Similar container setups
- **Deployment Scripts**: Duplicate deployment logic

### 6. **Testing Duplications**
- **Test Utilities**: Similar test helpers, mocks, or fixtures
- **Test Data**: Duplicate test datasets or scenarios
- **Test Patterns**: Similar test structures that could use shared utilities
- **Test Configuration**: Duplicate Jest, Vitest, or testing configurations

### 7. **Infrastructure Duplications**
- **Terraform Modules**: Similar infrastructure code
- **Kubernetes Manifests**: Similar deployment configurations
- **Monitoring/Logging**: Duplicate monitoring setups
- **Network Configurations**: Similar networking setups

## Required Analysis Output Format

### **Section 1: Directory Consolidation Opportunities**
For each opportunity, provide:
```
### [Category] - [Priority: High/Medium/Low]
**Files/Directories Involved:**
- `/path/to/dir1`
- `/path/to/dir2`

**Duplication Type:** [Exact/Near/Similar/Structural]
**Similarity Percentage:** [X% if applicable]
**Impact Assessment:** [Description of current problems]
**Recommended Action:** [Merge/Move/Delete/Refactor]
**Implementation Steps:** [Detailed steps]
**Risk Level:** [Low/Medium/High]
```

### **Section 2: File Consolidation Opportunities**
Same format as above but for individual files.

### **Section 3: Code Refactoring Opportunities**
For each code duplication:
```
### [Code Type] - [Priority: High/Medium/Low]
**Files Involved:**
- `/path/to/file1.ts:line-range`
- `/path/to/file2.ts:line-range`

**Duplication Description:** [What code is duplicated]
**Similarity Assessment:** [How similar are the implementations]
**Refactoring Strategy:** [Extract to shared package, create base class, etc.]
**Recommended Location:** [Where consolidated code should live]
**Impact Analysis:** [Benefits of consolidation]
**Migration Plan:** [Steps to implement without breaking changes]
```

### **Section 4: Configuration Consolidation**
```
### [Config Type] - [Priority: High/Medium/Low]
**Config Files:**
- `/path/to/config1`
- `/path/to/config2`

**Conflicts/Duplications:** [Specific issues]
**Standardization Approach:** [How to consolidate]
**Risk Assessment:** [Potential breaking changes]
```

## Specific Areas to Investigate Deeply

### **Critical Areas**
1. **Test Directories**: `/test` vs `/tests` and service-specific test folders
2. **Configuration Scattered**: Root-level vs service-level configs
3. **Component Organization**: Apps with both `components/` and `src/components/`
4. **API Clients**: Duplicate client implementations across packages
5. **Docker Files**: Similar containerization patterns
6. **Infrastructure**: `/k8s` vs `/infrastructure/k8s` duplication

### **Common Duplication Patterns**
1. **Authentication Logic**: JWT validation, middleware, guards
2. **Database Connections**: Similar connection setup code
3. **Error Handling**: Similar error formatting and response patterns
4. **Validation**: Similar input validation logic
5. **Logging**: Similar logging configurations and utilities
6. **HTTP Clients**: Similar axios/fetch configurations
7. **Environment Loading**: Similar .env file handling

### **Package-Specific Analysis**
1. **Shared Package Opportunities**: Code that could be moved to `/packages/shared/`
2. **Utility Consolidation**: Common functions across multiple services
3. **Type Definition Consolidation**: Shared TypeScript interfaces
4. **Component Libraries**: UI components that could be shared

## Analysis Methodology

1. **Systematic Scanning**: Start from root directory and traverse entire structure
2. **Pattern Recognition**: Look for similar naming patterns, file structures, and code patterns
3. **Content Analysis**: Use text comparison to identify similar/duplicate content
4. **Dependency Analysis**: Check for similar dependencies that could be consolidated
5. **Usage Analysis**: Determine which files/directories are actually used vs orphaned

## Output Requirements

- **Complete Coverage**: Every directory and file should be analyzed
- **Prioritized Recommendations**: High priority items should be actionable first
- **Implementation Guidance**: Provide specific steps for each consolidation
- **Risk Assessment**: Identify potential breaking changes or risks
- **Impact Quantification**: Estimate benefits of each consolidation (file count reduction, maintenance improvement, etc.)

## Success Criteria
- All duplicate directories and files identified
- All code duplications catalogued with refactoring strategies
- Consolidation opportunities prioritized by impact vs effort
- Clear implementation roadmap provided
- Risk mitigation strategies outlined for major changes

## Special Instructions
- Be extremely thorough - don't miss any duplication opportunities
- Consider both obvious and subtle duplications
- Think about long-term maintainability, not just immediate cleanup
- Suggest organizational improvements beyond just duplications
- Provide specific file paths and line numbers where applicable
- Consider the impact on CI/CD, deployment, and development workflows