// CodeNarc para core-api: conjunto elegido a mano. Con todas las reglas, la
// prioridad 1 incluiría reglas de estilo discutibles que bloquearían sin aportar.
// build.gradle bloquea la prioridad 1 (maxPriority1Violations = 0) y reporta el resto.
ruleset {
    ruleset('rulesets/basic.xml')
    ruleset('rulesets/exceptions.xml')
    ruleset('rulesets/imports.xml')
    ruleset('rulesets/unnecessary.xml')
}
