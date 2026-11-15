<?php
$backendRoot = realpath($argv[1] ?? dirname(__DIR__, 2).'/WMS_Warehouse_Hoa_Nam_BE');
if (!$backendRoot) { fwrite(STDERR, 'Backend source is unavailable'.PHP_EOL); exit(1); }
require $backendRoot.'/vendor/autoload.php';
require $backendRoot.'/app/Support/UserFacingMessageLocalizer.php';
use PhpParser\Node;
$root=$backendRoot;
$parser=(new PhpParser\ParserFactory)->createForNewestSupportedVersion();
$printer=new PhpParser\PrettyPrinter\Standard;
$records=[];$unresolved=[];$errors=[];$env=[];$constants=[];$wrappers=[];
function variants(Node $n):array {
 global $printer,$env,$constants;
 static $resolving=[];
 if($n instanceof Node\Expr\ConstFetch&&strtolower($n->name->toString())==='null')return [];
 if($n instanceof Node\Expr\Variable&&is_string($n->name)&&isset($env[$n->name])&&!isset($resolving[$n->name])){
  $resolving[$n->name]=true;$out=[];foreach($env[$n->name] as $value)$out=array_merge($out,variants($value));unset($resolving[$n->name]);return $out;
 }
 if($n instanceof Node\Expr\ClassConstFetch&&$n->class instanceof Node\Name&&$n->name instanceof Node\Identifier){
  $key=$n->class->getLast().'::'.$n->name->toString();if(isset($constants[$key]))return variants($constants[$key]);
 }
 if($n instanceof Node\Expr\Cast\String_)return variants($n->expr);
 if($n instanceof Node\Scalar\String_)return [[$n->value,[]]];
 if($n instanceof Node\Scalar\InterpolatedString){
  $text='';$bindings=[];
  foreach($n->parts as $p){if($p instanceof Node\InterpolatedStringPart){$text.=$p->value;}else{$key='value'.count($bindings);$text.='{'.$key.'}';$bindings[$key]=$printer->prettyPrintExpr($p);}}
  return [[$text,$bindings]];
 }
 if($n instanceof Node\Expr\BinaryOp\Concat){
  $out=[];foreach(variants($n->left) as [$a,$ab])foreach(variants($n->right) as [$b,$bb]){
   $rename=[];$offset=count($ab);foreach($bb as $key=>$expr)$rename['{'.$key.'}']='{value'.($offset++).'}';
   $new=[];foreach(array_values($bb) as $i=>$expr)$new['value'.(count($ab)+$i)]=$expr;
   $out[]=[$a.strtr($b,$rename),$ab+$new];
  }return $out;
 }
 if($n instanceof Node\Expr\Ternary)return array_merge($n->if?variants($n->if):[],variants($n->else));
 if($n instanceof Node\Expr\BinaryOp\Coalesce)return array_merge(variants($n->left),variants($n->right));
 if($n instanceof Node\Expr\Match_){$out=[];foreach($n->arms as $arm)$out=array_merge($out,variants($arm->body));return $out;}
 if($n instanceof Node\Expr\FuncCall&&$n->name instanceof Node\Name&&in_array(strtolower($n->name->toString()),['sprintf','vsprintf'])&&isset($n->args[0])&&$n->args[0]->value instanceof Node\Scalar\String_){
  $bindings=[];$text=preg_replace_callback('/%(?:\d+\$)?[-+0-9.]*[sdfu]/',function($m)use(&$bindings,$n,$printer){$key='value'.count($bindings);$arg=$n->args[count($bindings)+1]??null;$bindings[$key]=$arg?$printer->prettyPrintExpr($arg->value):'sprintf argument';return '{'.$key.'}';},$n->args[0]->value->value);return [[$text,$bindings]];
 }
 return [['{value0}',['value0'=>$printer->prettyPrintExpr($n)]]];
}
function emit(Node $expression,string $path,string $sink):void {
 global $records,$unresolved,$printer;
 if($expression instanceof Node\Expr\Array_){foreach($expression->items as $item)if($item)emit($item->value,$path,$sink);return;}
 foreach(variants($expression) as [$message,$bindings]){
  $base=['path'=>$path,'line'=>$expression->getStartLine(),'sink'=>$sink,'expression'=>$printer->prettyPrintExpr($expression),'bindings'=>$bindings];
  if(!preg_match('/\p{L}/u',preg_replace('/\{value\d+\}/','',$message))){$unresolved[]=$base;continue;}
  if(!preg_match('/\s/u',$message))continue;
  $records[]=$base+['source'=>$message,'normalized'=>App\Support\UserFacingMessageLocalizer::translate($message),'kind'=>$bindings?'dynamic':'static'];
 }
}
function walk($node,string $path,?string $method=null):void {
 if(is_array($node)){foreach($node as $v)walk($v,$path,$method);return;}
 if(!$node instanceof Node)return;
 if($node instanceof Node\AttributeGroup)return;
 if($node instanceof Node\Stmt\ClassMethod){
  global $env;$previousEnv=$env;$env=[];
  foreach((new PhpParser\NodeFinder)->findInstanceOf($node->stmts??[],Node\Expr\Assign::class) as $assignment){if($assignment->var instanceof Node\Expr\Variable&&is_string($assignment->var->name))$env[$assignment->var->name][]=$assignment->expr;}
  $method=$node->name->toString();
 }
 $name=null;$index=null;$sink=null;
 if($node instanceof Node\Expr\StaticCall&&$node->class instanceof Node\Name&&$node->name instanceof Node\Identifier){
  $class=$node->class->getLast();$name=$node->name->toString();
  if(in_array($class,['ApiError','PublicApiError'])&&$name==='abort'){$index=2;$sink='ApiError::abort';}
  elseif($class==='PublicApiError'&&$name==='invalidQuery'){$index=0;$sink='PublicApiError::invalidQuery';}
  elseif($class==='WarehouseException'&&$name==='invalidStatus'){$index=0;$sink='WarehouseException::invalidStatus';}
  elseif($class==='ValidationException'&&$name==='withMessages'){$index=0;$sink='ValidationException::withMessages';}
 }
 if($node instanceof Node\Expr\MethodCall&&$node->name instanceof Node\Identifier){
  $name=$node->name->toString();
  if(in_array($name,['respondError','respondNotFound','respondConflict','respondForbidden','respondBadRequest'])){$index=0;$sink=$name;}
  elseif(in_array($name,['respondSuccess','respondCreated','respondPaginated'])){$index=1;$sink=$name;}
  elseif($name==='rowError'||($name==='error'&&preg_match('/ImportService.php$/',$path))){$index=3;$sink='import row error';}
  elseif($name==='envelopeCurrent'){$index=0;$sink='envelopeCurrent';}
 }
 if($node instanceof Node\Expr\FuncCall&&$node->name instanceof Node\Expr\Variable&&$node->name->name==='fail'){$index=0;$sink='validation fail';}
 if($node instanceof Node\Expr\New_&&$node->class instanceof Node\Name&&str_ends_with($node->class->getLast(),'Exception')&&$node->class->getLast()!=='HttpResponseException'){$index=0;$sink='exception '.$node->class->getLast();}
 if($index===null&&($node instanceof Node\Expr\StaticCall||$node instanceof Node\Expr\MethodCall)&&$node->name instanceof Node\Identifier){
  global $wrappers;$name=$node->name->toString();
  $key=$node instanceof Node\Expr\StaticCall&&$node->class instanceof Node\Name?$node->class->getLast().'::'.$name:null;
  if($key&&isset($wrappers[$key])){$index=$wrappers[$key];$sink='message producer '.$key;}
  elseif(isset($wrappers['*::'.$name])){$index=$wrappers['*::'.$name];$sink='message producer '.$name;}
 }
 if($index!==null&&isset($node->args[$index]))emit($node->args[$index]->value,$path,$sink);
 if($node instanceof Node\ArrayItem&&$node->key instanceof Node\Scalar\String_&&in_array($node->key->value,['message','suggested_action','suggestedAction','error_message']))emit($node->value,$path,'payload '.$node->key->value);
 if(in_array($method,['messages','defaultMessage'])&&$node instanceof Node\Stmt\Return_&&$node->expr)emit($node->expr,$path,'validation messages');
 if($node instanceof Node\Expr\Assign&&$node->var instanceof Node\Expr\ArrayDimFetch){
  $base=$node->var;while($base instanceof Node\Expr\ArrayDimFetch)$base=$base->var;
  if($base instanceof Node\Expr\Variable&&is_string($base->name)&&preg_match('/errors$/i',$base->name))emit($node->expr,$path,'validation error assignment');
 }
 if($node instanceof Node\Expr\MethodCall&&$node->name instanceof Node\Identifier&&$node->name->toString()==='add'&&$node->var instanceof Node\Expr\MethodCall&&$node->var->name instanceof Node\Identifier&&$node->var->name->toString()==='errors'&&isset($node->args[1]))emit($node->args[1]->value,$path,'validator errors add');
 if($node instanceof Node\Stmt\ClassConst){foreach($node->consts as $const)if(str_contains($const->name->toString(),'SUGGESTED_ACTION')||str_starts_with($const->name->toString(),'MSG_'))emit($const->value,$path,'import hints');}
 foreach($node->getSubNodeNames() as $key)walk($node->$key,$path,$method);
 if($node instanceof Node\Stmt\ClassMethod)$env=$previousEnv;
}
// Discover message-bearing helper signatures before tracing their callers.
foreach(['app','Modules'] as $dir)foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$dir)) as $file){
 $path=$file->getPathname();if(!$file->isFile()||!str_ends_with($path,'.php')||preg_match('~[/\\\\](tests?|database|seeders?|migrations?|docs|vendor|build|Console|Swagger)[/\\\\]~i',$path))continue;
 try{$ast=$parser->parse(file_get_contents($path));foreach((new PhpParser\NodeFinder)->findInstanceOf($ast,Node\Stmt\Class_::class) as $class){
  foreach($class->getConstants() as $declaration)foreach($declaration->consts as $constant)$constants[$class->name.'::'.$constant->name]=$constant->value;
  foreach($class->getMethods() as $method)foreach($method->params as $i=>$param)if($param->var instanceof Node\Expr\Variable&&in_array($param->var->name,['message','errorMessage'])){$wrappers[$class->name.'::'.$method->name]=$i;$wrappers['*::'.$method->name->toString()]=$i;}
 }}catch(Throwable $e){}
}
foreach(['app','Modules'] as $dir)foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$dir)) as $file){
 $path=$file->getPathname();if(!$file->isFile()||!str_ends_with($path,'.php')||preg_match('~[/\\\\](tests?|database|seeders?|migrations?|docs|vendor|build|Console|Swagger)[/\\\\]~i',$path))continue;
 $rel=str_replace('\\','/',substr($path,strlen($root)+1));try{
 $ast=$parser->parse(file_get_contents($path));
 foreach((new PhpParser\NodeFinder)->findInstanceOf($ast,Node\Stmt\Class_::class) as $class)foreach($class->getConstants() as $declaration)foreach($declaration->consts as $constant)$constants[$class->name.'::'.$constant->name]=$constant->value;
 walk($ast,$rel);
}catch(Throwable $e){$errors[]=['path'=>$rel,'error'=>$e->getMessage()];}
}
file_put_contents(($argv[2] ?? __DIR__.'/../outputs/i18n-audit/backend-emitted.json'),json_encode(['records'=>$records,'unresolved'=>$unresolved,'parseErrors'=>$errors],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));echo count($records),' emitted variants, ',count($unresolved),' unresolved, ',count($errors)," parse errors\n";
