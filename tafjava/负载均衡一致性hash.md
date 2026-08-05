@[toc]
# 为什么要有一致性hash
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/0c491fa71761454490ebe586dd749e2b.png)
* 一个分布式kv存储的场景，我们是希望一个key的存储能够尽量固定在某台后端存储节点上，这样可
以减少数据不存在的处理复杂度.
* 最简单的就是 hash. 但是hash有一个问题就是下游节点数量变化的时候，很多数据映射的节点会发生变化.
* 一致性hash就是来解决这个问题的。下游节点数量变化的时候，请求的映射关系也基本上和之前是一致的.

# 一致性hash是什么
* 一致性哈希算法是对 2^32 进行取模运算，是一个固定的值
* 我们可以把一致哈希算法是对2^32进行取模运算的结果值组织成一个圆环，就像钟表一样，钟表的圆可以理解成由 60 个点组成的圆，而此处我们把这个圆想象成由2 ^ 32个点组成的圆，这个圆环被称为哈希环
* 将数据的hash值，放在hash环上，当数据来的时候，计算hash值，并在环上沿着顺时针方向找到最近的节点，即为目标节点.
* ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/14798493677f47f79dd4566b6a88afaa.png)
* 当增加或者删减节点的时候，只有这个位置附近两侧的数据受到影响. 所以影响面是非常小的.

## 节点均衡问题
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/1cf815f4e5904a2cb0a22f35952dfe29.png)
* 可以看到，这种情况下大部分的取值范围都会分配到节点A，会导致权重失衡. 这种在节点的存储压力，以及扩缩容的时候，会有大量的数据迁移工作.
* 为了解决这个问题，引入虚拟节点，节点数量多了之后，分布就会变得均匀很多.
* ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/55eb5012380440a0bc92170b02896631.png)
## 权重问题
* 一致性hash，有时候是想给某些节点分配更多的权重
* 针对这个问题，我们在虚拟节点上，给予更多的虚拟节点数量即可.
# 通用封装实现
* [具体实现](https://github.com/walkertest/JavaStudy/blob/master/src/main/java/com/tencent/alo/ConsistentHash.java)
* [测试方法](https://github.com/walkertest/JavaStudy/blob/master/src/test/java/com/tencent/alo/ConsistentHashTest.java)
* 以下代码实现包含了注释、测试用例.
* 核心过程：建立带虚拟节点的hash环（treemap存储）、选取节点（treemap.tailMap）
* 这里没有使用继承的设计方法去实现hash节点，这样对于 业务逻辑，会有更多的侵入. 转而采用了转换映射的方式. (有更好的实现思路的话，也可以留言交流.)
* 通过这样的封装，可以将一致性hash算法解耦出来，适用于任何场景中快速使用一致性hash算法.

```
package com.tencent.alo;

import java.io.UnsupportedEncodingException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * 一致性hash的封装工具类
 * 1. 将业务的节点数组转换成ConsistentHashNode对象的数组，ConsistentHashNode支持设置虚拟节点数（不同权重），并根据identityString建立一个映射关系，方便找到业务节点.
 * 2. 将ConsistentHashNode对象的数组转换成hash环，参考：buildConsistentHashCircle
 * 3. 根据请求的hash值去选择hash环上的一个ConsistentHashNode， 参考：selectHashCircleNode
 * 4. 根据映射关系映射到具体的业务对象.
 *
 * 这里选择对象映射的方式，而不是继承的方式来实现，是为了减少对业务对象的入侵.
 */
public class ConsistentHash {

    public static TreeMap<Long, ConsistentHashNode> buildConsistentHashCircle(Collection<ConsistentHashNode> nodes) {

        TreeMap<Long, ConsistentHashNode> result = new TreeMap<Long, ConsistentHashNode>();

        for(ConsistentHashNode node: nodes) {
            int replicaNumber = node.getReplicaNumber();
            replicaNumber = replicaNumber / 4 <= 0 ? 1 : replicaNumber / 4;
            for (int i = 0; i < replicaNumber; i++) {
                byte[] digest = md5(node.getIdentityString() + i);
                for (int h = 0; h < 4; h++) {
                    ConsistentHashNode tempNode = (ConsistentHashNode) node.clone();
                    long m = hash(digest, h);
                    tempNode.setHashValue(m);
                    result.put(m, tempNode);
                }
            }
        }
        return result;
    }

    public static ConsistentHashNode selectHashCircleNode(long inputHashKey, TreeMap<Long, ConsistentHashNode> circle) {
        //hash空间是0 ~ 2^32-1
        long dstHashNodeKey = inputHashKey & 0xFFFFFFFFL;
        if(circle != null && circle.isEmpty() == false) {
            //hash环上 顺时针寻找最近的一个节点
            if(circle.containsKey(inputHashKey) == false) {
                SortedMap<Long, ConsistentHashNode> tailMap = circle.tailMap(dstHashNodeKey);
                if (tailMap.isEmpty()) {   //负数或者不在这个区间的数就会命中这个.
                    dstHashNodeKey = circle.firstKey();
                } else {
                    dstHashNodeKey = tailMap.firstKey();
                }
            }

            ConsistentHashNode consistentHashNode = circle.get(dstHashNodeKey);
            return consistentHashNode;
        }

        return null;
    }

    private static byte[] md5(String value) {
        MessageDigest md5;
        try {
            md5 = MessageDigest.getInstance("MD5");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e.getMessage(), e);
        }
        md5.reset();
        byte[] bytes = null;
        try {
            bytes = value.getBytes("UTF-8");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e.getMessage(), e);
        }
        md5.update(bytes);
        return md5.digest();
    }

    private static long hash(byte[] digest, int number) {
        return (((long) (digest[3 + number * 4] & 0xFF) << 24) | ((long) (digest[2 + number * 4] & 0xFF) << 16) | ((long) (digest[1 + number * 4] & 0xFF) << 8) | (digest[0 + number * 4] & 0xFF)) & 0xFFFFFFFFL;
    }
}
```

```
package com.tencent.alo;

public class ConsistentHashNode {

    int defaultConHashVirtualNodes = 100;

    int replicaNumber = defaultConHashVirtualNodes;

    String identityString;

    long hashValue;   //根据identityString计算的实际hash值

    public int getReplicaNumber() {
        return replicaNumber;
    }

    public void setReplicaNumber(int replicaNumber) {
        this.replicaNumber = replicaNumber;
    }

    public String getIdentityString() {
        return identityString;
    }

    public void setIdentityString(String identityString) {
        this.identityString = identityString;
    }

    public long getHashValue() {
        return hashValue;
    }

    public void setHashValue(long hashValue) {
        this.hashValue = hashValue;
    }

    @Override
    public String toString() {
        return "ConsistentHashNode{" +
                "defaultConHashVirtualNodes=" + defaultConHashVirtualNodes +
                ", replicaNumber=" + replicaNumber +
                ", identityString='" + identityString + '\'' +
                ", hashValue=" + hashValue +
                '}';
    }

    @Override
    protected Object clone() {
        ConsistentHashNode consistentHashNode = new ConsistentHashNode();
        consistentHashNode.setHashValue(this.hashValue);
        consistentHashNode.defaultConHashVirtualNodes = this.defaultConHashVirtualNodes;
        consistentHashNode.setReplicaNumber(this.replicaNumber);
        consistentHashNode.setIdentityString(this.identityString);
        return consistentHashNode;
    }
}
```

# tars框架中的实现
* tars rpc中的一致性hash负载均衡算法，只是一致性hash算法的一个应用场景而已.
* 使用上面的通用封装能力，将被调节点建立好hash环，并建立好节点和被调之间的映射关系
* rpc调用的时候，调用通用封装中的select方法，选择好hash节点，然后根据映射关系，找到真实的被调节点即可.

```
        //将invoker转换成hash节点.
        ConcurrentHashMap<String,Invoker<T>> invokerMap = new ConcurrentHashMap<>();
        consistentHashNodeTreeMap = LoadBalanceHelper.buildConsistentHashCircle(sortedInvokersTmp, config,invokerMap);
        invokerConcurrentHashMap = invokerMap;
```

```
        long consistentHash = getHash(consistentHashValue);

        //根据hash值，从hash环上寻找最近的一个节点
        ConsistentHashNode consistentHashNode = ConsistentHash.selectHashCircleNode(consistentHash, consistentHashNodeTreeMap);
        //映射为invoker
        Invoker consistentHashInvoker = getInvoker(consistentHashNode);
```

# 参考
* [ 小林coding](https://xiaolincoding.com/os/8_network_system/hash.html )
* [tars一致性hash](https://github.com/TarsCloud/TarsJava/blob/v1.7.x/core/src/main/java/com/qq/tars/client/rpc/loadbalance/ConsistentHashLoadBalance.java)
* [dubbo 一致性hash ](https://github.com/apache/dubbo/blob/3.3/dubbo-cluster/src/main/java/org/apache/dubbo/rpc/cluster/loadbalance/ConsistentHashLoadBalance.java)