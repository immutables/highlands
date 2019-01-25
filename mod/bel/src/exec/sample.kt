package exec

import java.util.Arrays
import kotlin.concurrent.thread


/**
 * Hello **World**!
 *
 * ~~~
 * Example
 * class X {
 * }
 * ~~~
 */
interface Gendalf {

}

fun main(args: Array<String>) {
  val s: Gendalf? = null
  var g: Int = 1

  thread(name = "Thread1") {
    val a = Arrays.toString(args)
    println("UI!!! ${a}")
  }.join()
}
