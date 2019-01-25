require('./highlands/')
  .lib('//lib/google/common', 'com.google.guava:guava:26.0-jre')
  .lib('//lib/immutables/value', 'org.immutables:value:2.7.3', {
    processor: 'org.immutables.processor.ProxyProcessor'
  })
  .lib('//lib/kotlin/stdlib', [
    'org.jetbrains.kotlin:kotlin-stdlib:1.3.11',
    'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.11',
    'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.3.11',
  ])
  .lib('//lib/immutables/value:annotations', 'org.immutables:value:annotations:2.7.3')
  .lib('//lib/junit', ['junit:junit:4.12', 'org.hamcrest:hamcrest-core:1.3'])
  .run()
