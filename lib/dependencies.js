import ContextDependency from 'webpack/lib/dependencies/ContextDependency';
import ModuleDependency from 'webpack/lib/dependencies/ModuleDependency';
import NullDependency from 'webpack/lib/dependencies/NullDependency';

var CriticalDependencyWarning;
try {
  CriticalDependencyWarning = require("webpack/lib/dependencies/CriticalDependencyWarning");
}
catch (_) {}

var HarmonyModulesHelpers, HarmonyImportSpecifierDependency, HarmonyExportImportedSpecifierDependency;
try {
  HarmonyModulesHelpers = require("webpack/lib/dependencies/HarmonyModulesHelpers");
  HarmonyImportSpecifierDependency = require('webpack/lib/dependencies/HarmonyImportSpecifierDependency');
  HarmonyExportImportedSpecifierDependency = require('webpack/lib/dependencies/HarmonyExportImportedSpecifierDependency');
}
catch (_) {}

export default {
  HardModuleDependency: HardModuleDependency,
  HardContextDependency: HardContextDependency,
  HardNullDependency: HardNullDependency,
  HardHarmonyExportDependency: HardHarmonyExportDependency,
  HardHarmonyImportDependency: HardHarmonyImportDependency,
  HardHarmonyImportSpecifierDependency: HardHarmonyImportSpecifierDependency,
  HardHarmonyExportImportedSpecifierDependency: HardHarmonyExportImportedSpecifierDependency,
};

class HardModuleDependency extends ModuleDependency {
  constructor(request) {
    super(request);
  }
}

class HardContextDependency extends ContextDependency {
  constructor(request, recursive, regExp) {
    super(request, recursive, regExp);
  }

  getWarnings() {
    if(this.critical) {
      return [
        new CriticalDependencyWarning(this.critical)
      ];
    }
  }
}

if (CriticalDependencyWarning) {}

class HardNullDependency extends NullDependency {
  constructor() {
    super();
  }
}

class HardModuleDependencyTemplate {
  apply() {}
  applyAsTemplateArgument() {}
}

class HardHarmonyExportDependency extends NullDependency {
  constructor(originModule, id, name, precedence) {
    super();
    this.originModule = originModule;
    this.id = id;
    this.name = name;
    this.precedence = precedence;
  }

  getExports() {
    return {
      exports: [this.name],
    }
  }

  describeHarmonyExport() {
    return {
      exportedName: this.name,
      precedence: this.precedence,
    }
  }
}

class HardHarmonyImportDependency extends ModuleDependency {
  constructor(request) {
    super(request);
  }

  getReference() {
    if(!this.module) return null;
    return {
      module: this.module,
      importedNames: false
    };
  }
}

class HardHarmonyImportSpecifierDependency extends HarmonyImportSpecifierDependency {
  constructor(importDependency, id, name) {
    super(importDependency, null, id, name, null);
  }
}

if (typeof HarmonyImportSpecifierDependency !== 'undefined') {}

class HardHarmonyExportImportedSpecifierDependency extends HarmonyExportImportedSpecifierDependency {
  constructor(originModule, importDependency, id, name) {
    super(originModule, importDependency, null, id, name, null);
  }
}

if (typeof HarmonyExportImportedSpecifierDependency !== 'undefined') {}
