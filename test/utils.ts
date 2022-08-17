import assert from 'assert';
import crypto from 'libp2p-crypto';
import { encode, get_intersection_actions, random, shuffle, shuffle_n_array, sort_n_array } from '../src/backend/utils';
import { Context } from '../src/backend/types';
import IPFS from '../src/backend/ipfs';
import PeerId from 'peer-id';
import { ActionBundle, Actions, ActionSignatures, ActionsTestimony, ActionSubjects, ActionType, Witnesses, WitnessSignatures, WitnessTestimony, WitnessTestimonyCIDs } from '../src/shared/types';
import { RSA_sign, RSA_verify } from '../src/shared/utils';

const test_peers = {
  a: {
    id: 'QmZtDcGMnBXaZUdteugL6dAWU6UWUYphxCyaMpC7DsoMc7',
    privKey:
      'CAASpwkwggSjAgEAAoIBAQDuEitPLCjxaItnzpH+ObQd+Ft42qAMeo8orAT+ARUXyHBbbkymvQavk7CQBK6ZmgsRl3tZDurTIyoq9qFGcXY7eBA4TCcrEbCkAhfclWAmrCPFkjw6znI56TBn6Yk8BFI2kvB9xBjJCX0BsNSBDE/JDKfKRWuQz5yoCNkeh7XmmIP2xJtTVEQv/nyEtp+dObLXnGoEBSvGoU3pbnnqIPZ65zy9wQmk6QEMcfpS5J5fh6vloZGLy9NFkBk5InfOeivcjVbOltl/QwtC+0cKL4zJAFJLX4IeGYaX5lU/i/m2epq/vNmxXPe25vDZpSy23Zpom+LV6EzoIobJEqb0jsXXAgMBAAECggEARLYDv/cL3hkBWzWYl1pKLPg4VlorJU7eMKvtSO5BCzszin/8KYeW/WfP5tEjH3wBQ9OHqz2N8uBMVFgYVf97U1Ckxcrc5yZU6BEel/CY7rByJpy9O2/IMgSmjuctT6AjplKkjHfje2p8pNdHjfNit7EqYEvG7uWs3ianm5MpoeLGacyFYWSy6Yw6u7TBsE+Ldte1boPDXJPyE/OYUsj3qgDosrF9NJ5OqkIodHUs7DtpsLD130duUuB4feMnCudLnQXYjyF3ITdZRRh6ahA83XQIdMx/Y4VzefxSjR8mqbiU+k65ayNcDdNM3uXGqIZ5i8JPk4N1tUPwLxn+0EhICQKBgQD+bSAtQO0t/FSsh1nXWdZWkFWg0dZz+e5GKJXuVd1IWi63SE1DOemZXGXTh5v3iqCAcxBGoVaYlN3aQX5Lr/yLcMDdwn6OkgGrZTLDNIefM+wfyKdjvZUAFjCJqb7l2LskJVGRlhjiz/pei0W7T80vQPvLRXM65JdxhCblEg1njQKBgQDviyU/EZN2Gh9QF5JU9tXZfezmwHOizattv6jHef2RGOdeCflwxZo4Il+e+7bbFPFEbij9fy520ZLeXmJsipIObEsT5Ii0WWakI/mmn6+oNcWvu0r9Vvb1FsdlYdVq6BWxp5CZaJOUQbT6HGw5rZbW8DDq1gXUWwiKEbEBpAsn8wKBgQC5PfLDgBYv+RwdUZ7T8JDiDcyKfr1JS5t0cXBYSyQF3cNNptK6M5wlEOUCkiW4obIiU6RyCF3oUdsFYdH2gXe6fqmtzEIgw6V7iP7gqYplG4S7z3gwYoPtwDouwOxApP/8XT96ZHJSEWMVGwn2Sy/1S7cIVNSE+JJbEADRn8cqsQKBgGPgE0aJkH80gwvE2DletWk6TNUlNtGRiUF4IOoS3ftqc8VMyVkQuq1e/5ltAB+2SqYqfCK9rWTTGrZmigkRebZTxrXjmm//uoEDkuq7N+UdjnAn2ito4AzuU3Lc6LvrSmhJIkwkQywUfV2vDhy6WOMDQJIZbFLPJe9TUwcJG7GrAoGAP8G9vX3cCT21CdSzQhsNCYaWt20V3gwaNuKQB5S8xyiJgqlKBsK/TFqYXID7UCZ+1gEwyYXuvDLSOzgUbUOxkV0bpCHsJnUSfq/Lw5q9TuYB702f27Q9Ar/wLSW5xuVipRybBO7J/Nj8yMV3ePKG97BHbKqTXM4jX03nLiAyTLE=',
    pubKey: 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDuEitPLCjxaItnzpH+ObQd+Ft42qAMeo8orAT+ARUXyHBbbkymvQavk7CQBK6ZmgsRl3tZDurTIyoq9qFGcXY7eBA4TCcrEbCkAhfclWAmrCPFkjw6znI56TBn6Yk8BFI2kvB9xBjJCX0BsNSBDE/JDKfKRWuQz5yoCNkeh7XmmIP2xJtTVEQv/nyEtp+dObLXnGoEBSvGoU3pbnnqIPZ65zy9wQmk6QEMcfpS5J5fh6vloZGLy9NFkBk5InfOeivcjVbOltl/QwtC+0cKL4zJAFJLX4IeGYaX5lU/i/m2epq/vNmxXPe25vDZpSy23Zpom+LV6EzoIobJEqb0jsXXAgMBAAE=',
  },
  b: {
    id: 'QmRX2d4WUnBcVicWb6ZS1ixriUNPFyoTeVuUPwG82fdaXW',
    privKey:
      'CAASpgkwggSiAgEAAoIBAQCeNNWb1kpNwd2jit8CBtQ7ZEvkFS5fz5cAokiyk1sXsaeQITkas/8/j+kiX+1hG83zlZsS1hLZngr+RFow6BKYz07aJsOXk2LgAYBaNH4K7IUXbank0LYZzKxdbFUu1uUUKMUnyCSwSzFdGiIR0rr7f/g7v7zs9Z5qu0hHvFrU8DxW9n6Z34H+TEpkvwteqeMGLw91kXYG/1eTCSvJBlZasg288fnPCyG9vUHil++Z7a+OjrTfgZMQpjro5LxBVQ6NyAC1C7Yn5w4N7cxQEZO6XCwhFEwgtlg+pw508FTUhlskNFkf29Pxq3KHP8rgLMDa06xUT0IKoRqFKU3kE6h/AgMBAAECggEANv0QPfE2tF4s5lovdynefKI4ypceHkkuKBdAA2m6YLrsDemuSnzDvFkN5FfJT1Z1uDOIyfxEYwVOtuAVJSiUxi5QLv0IQNgGput+rFvQb4WUIPeJ9LEiikccpgAwf25MAzzEgjZLokcQalbZ/q3rNd1d746OYSJiJKDh16U9QQOPQYGmtTWOSdmekbkSKuUJ3D+jwa9a9d2lo3nPqchotIYFSG/A31hc5KQ/8XwOagcv76PCQonEfnuL9V3UOwm9EjX07kvzAYPeyvsQJChWLHJF2f789uvCVIMgSlC0og5IB84WlEguduNSuMbLw/yAVdAho8XAtpNR/a/Mnbq1QQKBgQDRm9ANGi1LqQCCf7+QBjjfOGqtUUSCwTbkXbjrCi8oGaIE4n/XfHSOoRZYXPQiszNe314dTMJ829lSXhbVugYk9Snrvas/r1KWgtmbTktZDmSqKPE976cnWBbJbnEurORsYkn3dVinhZvTKFPJm0L9t5ccWQBIDYnRb+Q78UH8IQKBgQDBOKDQ7QJhrNsIQ6yqyII5QB+paYcrVq3DrIlutDVMBoZX93aJO1Ju9Tb7cGY0KLDJD55wArnLB5Z5yd2PZggZFD1la1jw3QqlkPgsNKUyHEoyV5BtnjuDNTGTsHpUDiIvPhlJTukkf40DlSn3r22KVcsBG9P9MBoOFM+3EZYQnwKBgH8NsE3Q2TXsahewMcCuVNjRjLAj+6A6V/iS6tzlnnHzH6dQV+eZU9mEwVOsfHtwHipawOSHu7gNVyy7RaIlkUXjqZZwsJX4wtni1N5z1e5UcCZIjPpbAvoxRhaxMD/3oroj1ev+oE9jCHI1Fpy01SWPnDQdqrMCKdDevvyqn7GhAoGAfNeB0HvSVhnBS42uOopi2Wq9ClDMrQvMKemIwqZc6Uot8xhI1lIl6Ns3My5kWr8PulkFHYolUTEN4JK1PLnH8axKHwVE6htnjaIlNyqssbvllLFO+ASMnzH3Xl1gLH8VR0DwRZVevd5L1kzCWO5X8FGOYKECT0yNCRwZOUd7ljECgYAhFdklZD0N24NF2m5pwMAQ9Ml8fgOkMUyRRZSc7Tv0Bxi4KswKXNzinTGu9PfgF7jmTuTVVSpba2w9wspIZOaGFoWmlmPMd7YATnd6cS9W4ycyv0S5kHOnIVeA/ASc5b/2d21qwk21FJC1XLszweYsd4zkUI/tx2aSLAZzAymaHA==',
    pubKey: 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCeNNWb1kpNwd2jit8CBtQ7ZEvkFS5fz5cAokiyk1sXsaeQITkas/8/j+kiX+1hG83zlZsS1hLZngr+RFow6BKYz07aJsOXk2LgAYBaNH4K7IUXbank0LYZzKxdbFUu1uUUKMUnyCSwSzFdGiIR0rr7f/g7v7zs9Z5qu0hHvFrU8DxW9n6Z34H+TEpkvwteqeMGLw91kXYG/1eTCSvJBlZasg288fnPCyG9vUHil++Z7a+OjrTfgZMQpjro5LxBVQ6NyAC1C7Yn5w4N7cxQEZO6XCwhFEwgtlg+pw508FTUhlskNFkf29Pxq3KHP8rgLMDa06xUT0IKoRqFKU3kE6h/AgMBAAE=',
  },
  c: {
    id: 'QmQN3pYWmQ4ewxqfKRZMa3xQcRyiz8sQSqXicSuT1pViVM',
    privKey:
      'CAASpwkwggSjAgEAAoIBAQCnRwa5ytrvG7vXkNRB8OA7gKmC1ZCA1kGEfuPrY/uebaaFoZj9rVZ4P9G9t17NcT+tmO300TuCLSwQeXxKIrQX9HCJRmCNv3EM+9YxBhpw3thF68XnJh++nx78ndsV2QzXehNeHyFQITUjWcs2XZ0G3tLUu68TfbWtdEd8oECGvtkiqIzroOKVbAOVx2u/F7z6lYh6exH5k4H3YDpCIoRXjdOHraRDjy6sQVFleQxVeC2xV/wfv772uKYYzAM7hTvk/UTf9uS0szS+DcN6MiQeiiBGqL9bdmf6+22ldxLCF8Tie2ubx6mdgL/iDpWmC+wL9CZ5CqneFSOw+3bkLpBnAgMBAAECggEAULrxnwcs5EshO+cU2YIz5eOxa4hAhj1hP12yB++oBwzqWgHkgUF/wuciBYqTAVmPnut4pDe6nZfJdWX8OxdGjW0WRtolTSPAnsCH3f8REboq7IveZjE7DtdisA5LJt8q2G99G2awwChWqenzLhi96Qvu+mZeF20LGlxNB/ObUKvQ2iU/yKfjddLoOZqJ8sSlCzIHPUMmzdp01FY4iss2bU5HmEMlBEng5vYzghOquqVzBtgtQz4/bKdPF2+9t4owUrlYnnpe6rKFr8/QdlFc9WZqcYEpkoJkrxV8F8uEgkHucB6CT8JBQg/nnBpIh3qvr3pp/7Ip0FNZLMVH+DMYEQKBgQDXx4mw3IxVyAFc/NdaMFb8yJ0+vXoXz6B9Yqg5IIdv/iyIjZG8kiY8oJ1NavLslZO+8JEjxmT9PtH7GCICEkIRHDhBOGHeKYtzEs/tOpQLcfqHPJMyeAVIbWCXs9fURssMsPm4knmbbQtRmOfFo2KVX3PiBD31myoszuq0bFJI2QKBgQDGdRfFHRfmYRXwtWO3iyeLRViPi5iKuELZmKLCUq5ClcVCu6rKmanZMtzSh/Za0N0YGyrFUSjP9MsLt8ncUufrFiIXM+F8H0kAvdIpkL5XCfwti7fhNnPbfwz9YgIVZBt2fsuNWWnCr/nO5MwG5YnBTPwfoN6H3u7vNYqnqmXbPwKBgAeJV5zOxzQDzVBjIF5tC8y+cQeM9KO6Q7+9X2THZxOZTBLk5u8wJ5e8gGIA10U+IC/uFROrzUEvHYRonl92JcqVMr3Ma1aoGs/FG3AMuLkBnR92FSoRGRYjg9koleQ7KMJjuAUjUI4GK/wInCfCAiJ3eAOv5D4c0kdIXtg4ZFNZAoGBAJ+pEm+FgXXZw6H8/HVsoWq9ZotNnnJz3WxcDQ1TIVj2T1Xpz3ThfTD9Z4SE1+CmSkmbiaRnL/NmGHib6u2zUVvjWZfbKFwIe136WPsRtOAna1dlIZExkrITG+s6Dz0QZbvGNJLKTXjQxKP7lF00C8iU2/3CGWWsKAQQyjUrtHhXAoGARo8maVUrmI7ZtVK58QHCoRaLzo41buB1GPZIvGa5IsXOQb7sjzJtgcWxyQEKJIYLoKVv7YjzscjuIAVw2BVUGpeC48fr3G9Ehi4DFuCuSElOYc6hTiinQdymuqodXTEL2z6BWL9h7sp5mlsfW5GO9oKEnSRrmowMibgF9She7pA=',
    pubKey: 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCnRwa5ytrvG7vXkNRB8OA7gKmC1ZCA1kGEfuPrY/uebaaFoZj9rVZ4P9G9t17NcT+tmO300TuCLSwQeXxKIrQX9HCJRmCNv3EM+9YxBhpw3thF68XnJh++nx78ndsV2QzXehNeHyFQITUjWcs2XZ0G3tLUu68TfbWtdEd8oECGvtkiqIzroOKVbAOVx2u/F7z6lYh6exH5k4H3YDpCIoRXjdOHraRDjy6sQVFleQxVeC2xV/wfv772uKYYzAM7hTvk/UTf9uS0szS+DcN6MiQeiiBGqL9bdmf6+22ldxLCF8Tie2ubx6mdgL/iDpWmC+wL9CZ5CqneFSOw+3bkLpBnAgMBAAE=',
  },
  d: {
    id: 'QmUs3DoigrHRKwL3kHx39RUzT3iAuRn8mE13WGjgKr1C2r',
    privKey:
      'CAASqQkwggSlAgEAAoIBAQDwM21XQy5yojcr9Qelz8Ow0rcOaV2dRpupr9UrVh7bxy0aQcO8nJ5oPdgFHZyvOuMOxwF3D/Tk/hGIa16igJXmeogHKU5yc8jo4e8VAD+BJAadvJwAs7Qi63UM9HK5L+4ghrCfl89rSXUcnSPeu/JOPms2ji0AxLRZYF5JCTRpHHrW5EDQXqT/Udc3RjAP/DMsdS5Dkq1StOcjpFBGOMb3e0Qvq8y+w4abDhcEql8fwnPRvGGQ/UmkEpIYvfhlRKFyTlkZL7zfwtR7CCqTE2HdKq4PVHl2HpNdws+WCP5dRQXcbWBH5NsGOYj6pgURG456sY9fpRW5yazaAeTcuEfhAgMBAAECggEBAMFlttC+z8QOpftng2vW18okLq2U2oIKWsUKRMlqwtfUC5WLg+z18Xke6jJcQE66TB0W0DAsEdLaWgWL5ZtTit4SpDmX4Yi3fvk7CIPROlBhUE5qkPTju9Mt34W5wDEozUM1DzrAQYoxj/Ck+T+Z9iNXkH1RhhyLRGZ9+Aw4NBG4BDokHIQb/2M9TEM9ejbGlo+6j5/lwUREV+TrJRQ25dZVgH8soDCEx3mjaMGO6N99typMzB4BlQmGZgS4mYPuST5qnqbPB5PpphniJnJeO0+PJhBBNd1DMm7qBlgvO1avvb9Dpa6SUUwksAkyTeUyve8KakkQxHCY6dk/u/8aju0CgYEA+xn9VtBqn7gVS/h2ThQtzFyEVCQXFoCo6/Ncj5rOked40cRSz317poyzHbM9AKdJDFjm0csJHTLF1OHljzNgYthl8JvlWY2azSyL9j0tHkmo6e9bU1fDwYq/1er7nX/2UZrTf/YPzP2mYkTKVRU9NzMLTF/qiTfOuoYJImh0HeMCgYEA9OL/1AkynMt7DaROmifaqOXpqkyiTa8LhP/gYt5dmRIR3ukX7vsr8LHbXgzfPyC7UE+QA1oWLXwxtC4dTmDDVzggTVpRSjC6cn+OmsmQ6G6IAIxv8Uw9eCwrqyU17f7ZtmkJgons7MdqBicEpLxQvnGPXaadpB0K8JwbKRa7LmsCgYB2DPrwxJ1MJ8RDajVccdoyONCxqiH8n1JLU6eRkAtLxxIjNHRmPi1S2NUgwnKMixkpp+YkfZr0Ujl14xoEn/fRoMEURIan+o3rpeTLSGmc0q6KBNDftuQ+apfT31yZ6F4KcYq7nxhAnIOLsaGaLJkSCXpnVrSx/D3BrWA///GPVwKBgQC7ALWXt8Zckc5QJo6XjaOeoqODFq5CYE+NqtAw79nN0EyxSpKqPkfZsBfyhCXe0SH5PCifRqX06ggSrbxXY/EHo6aXK0c0Pm3CjcHaVd5AgFd/A79gJnYyVJisQugh7CFY+HD4rFauocFHHXigS+Xk6FcwjtGGx17ZSnw7Lk6WLQKBgQCZLdGILpYMIx7MXDzWeYjvEzhHSx/AY6Qzd8oUf6t63WYRMqc/vbqPqxaPMvFPLd9A8S1qi/Qq2Yphfq5K5m5GtR0D/slAAyW1+80WTQfT5Iaud3vowfZVYx0l4Qy0JpPPIOjxTGso5f4z5ZxiMCm2gR8m43D+224F1NHcp0I0nA==',
    pubKey: 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDwM21XQy5yojcr9Qelz8Ow0rcOaV2dRpupr9UrVh7bxy0aQcO8nJ5oPdgFHZyvOuMOxwF3D/Tk/hGIa16igJXmeogHKU5yc8jo4e8VAD+BJAadvJwAs7Qi63UM9HK5L+4ghrCfl89rSXUcnSPeu/JOPms2ji0AxLRZYF5JCTRpHHrW5EDQXqT/Udc3RjAP/DMsdS5Dkq1StOcjpFBGOMb3e0Qvq8y+w4abDhcEql8fwnPRvGGQ/UmkEpIYvfhlRKFyTlkZL7zfwtR7CCqTE2HdKq4PVHl2HpNdws+WCP5dRQXcbWBH5NsGOYj6pgURG456sY9fpRW5yazaAeTcuEfhAgMBAAE=',
  },
};

describe('utils test', function() {
  it('shuffle', function() {
    const res = shuffle([1, 2, 3, 4, 5], 123);
    const test = [4, 5, 2, 3, 1];
    for (const i in test) {
      assert.strictEqual(test[i] === res[i], true);
    }
  });
  it('shuffle_n_array (h > w)', function() {
    const res = shuffle_n_array(
      [
        [1.1, 2.1, 3.1],
        [1.2, 2.2, 3.2],
        [1.3, 2.3, 3.3],
        [1.4, 2.4, 3.4],
      ],
      123,
    );
    assert.strictEqual('[[3.1,2.1,1.1],[3.2,2.2,1.2],[3.3,2.3,1.3],[3.4,2.4,1.4]]' === JSON.stringify(res), true);
  });
  it('shuffle_n_array (w > h)', function() {
    const res = shuffle_n_array(
      [
        [1.1, 2.1, 3.1, 4.1, 5.1],
        [1.2, 2.2, 3.2, 4.2, 5.2],
        [1.3, 2.3, 3.3, 4.3, 5.3],
      ],
      123,
    );
    assert.strictEqual('[[4.1,5.1,2.1,3.1,1.1],[4.2,5.2,2.2,3.2,1.2],[4.3,5.3,2.3,3.3,1.3]]' === JSON.stringify(res), true);
  });
  it('sort_n_array (w > h)', function() {
    const res = sort_n_array(
      [
        [1.1, 2.1, 3.1, 4.1, 5.1],
        [1.2, 2.2, 3.2, 4.2, 5.2],
        [1.3, 2.3, 3.3, 4.3, 5.3],
      ],
      (a, b) => b - a,
    );
    assert.strictEqual('[[5.1,4.1,3.1,2.1,1.1],[5.2,4.2,3.2,2.2,1.2],[5.3,4.3,3.3,2.3,1.3]]' === JSON.stringify(res), true);
  });
  it('sort_n_array (h > w)', function() {
    const res = sort_n_array(
      [
        [1.1, 3.1, 2.1],
        [1.2, 3.2, 2.2],
        [1.3, 3.3, 2.3],
        [1.4, 3.4, 2.4],
      ],
      (a, b) => b - a,
    );
    assert.strictEqual('[[3.1,2.1,1.1],[3.2,2.2,1.2],[3.3,2.3,1.3],[3.4,2.4,1.4]]' === JSON.stringify(res), true);
  });
  it('rsa', async function () {
    const a = await PeerId.createFromJSON(test_peers.a);
    const b = await PeerId.createFromJSON(test_peers.b);
    const obj = { x: 1 };
    const signature_a = await RSA_sign(a.privKey, encode(obj));

    assert.strictEqual(await RSA_verify(
      crypto.keys.unmarshalPublicKey(a.pubKey.bytes),
      encode(obj),
      signature_a,
    ), true);
    assert.strictEqual(
      await RSA_verify(
        crypto.keys.unmarshalPublicKey(a.pubKey.bytes),
        encode({ x: 2 }),
        signature_a,
      ),
      false,
    );
    assert.strictEqual(
      await RSA_verify(
        crypto.keys.unmarshalPublicKey(a.pubKey.bytes),
        encode(obj),
        await RSA_sign(b.privKey, encode(obj)),
      ),
      false,
    );
  });
  it('get_intersection_actions', async function () {
    const a = await PeerId.createFromJSON(test_peers.a);
    const b = await PeerId.createFromJSON(test_peers.b);
    const c = await PeerId.createFromJSON(test_peers.c);
    const d = await PeerId.createFromJSON(test_peers.d);
    const before_prev_block_hash = 'xxxx';
    const prev_block_hash = 'yyyy';
    const start_timestamp = 0;
    const actions_a: Actions = [
      {
        type: ActionType.Comment,
        content_cid: '',
        proposal_id: 'proposal_a',
      },
    ];
    const actions_b: Actions = [
      {
        type: ActionType.Comment,
        content_cid: '',
        proposal_id: 'proposal_b',
      },
    ];
    const actions_c: Actions = [
      {
        type: ActionType.Comment,
        content_cid: '',
        proposal_id: 'proposal_c',
      },
    ];
    const actions_d: Actions = [
      {
        type: ActionType.Comment,
        content_cid: '',
        proposal_id: 'proposal_d',
      },
    ];
    const testimony_a: ActionsTestimony = {
      actions: actions_a,
      before_prev_block_hash,
      mid: test_peers.a.id,
      start_timestamp,
    };
    const testimony_b: ActionsTestimony = {
      actions: actions_b,
      before_prev_block_hash,
      mid: test_peers.b.id,
      start_timestamp,
    };
    const testimony_c: ActionsTestimony = {
      actions: actions_c,
      before_prev_block_hash,
      mid: test_peers.c.id,
      start_timestamp,
    };
    const testimony_d: ActionsTestimony = {
      actions: actions_d,
      before_prev_block_hash,
      mid: test_peers.d.id,
      start_timestamp,
    };
    const actions_signature_a = await RSA_sign(
      a.privKey,
      encode(testimony_a),
    );
    const actions_signature_b = await RSA_sign(
      b.privKey,
      encode(testimony_b),
    );
    const actions_signature_c = await RSA_sign(
      c.privKey,
      encode(testimony_c),
    );
    const actions_signature_d = await RSA_sign(
      d.privKey,
      encode(testimony_d),
    );
    const mock_ipfs = ({
      get: async (cid: string) => {
        const data = {
          testimony_a: {
            prev_block_hash,
            actions_broadcast_window_start: 0,
            actions_broadcast_window_end: 1,
            action_bundle_cid: 'action_bundle_a',
            action_signatures_cid: 'action_signatures_a',
            action_subjects_cid: 'action_subjects_a',
          } as WitnessTestimony,
          testimony_b: {
            prev_block_hash,
            actions_broadcast_window_start: 0,
            actions_broadcast_window_end: 1,
            action_bundle_cid: 'action_bundle_b',
            action_signatures_cid: 'action_signatures_b',
            action_subjects_cid: 'action_subjects_b',
          } as WitnessTestimony,
          testimony_c: {
            prev_block_hash,
            actions_broadcast_window_start: 0,
            actions_broadcast_window_end: 1,
            action_bundle_cid: 'action_bundle_c',
            action_signatures_cid: 'action_signatures_c',
            action_subjects_cid: 'action_subjects_c',
          } as WitnessTestimony,
          action_bundle_a: [
            actions_a,
            actions_b,
          ] as ActionBundle,
          action_signatures_a: [
            actions_signature_a,
            actions_signature_b,
          ] as ActionSignatures,
          action_subjects_a: [
            a.toB58String(),
            b.toB58String(),
          ] as ActionSubjects,

          action_bundle_b: [actions_a] as ActionBundle,
          action_signatures_b: [
            actions_signature_a,
          ] as ActionSignatures,
          action_subjects_b: [
            a.toB58String(),
          ] as ActionSubjects,

          action_bundle_c: [
            actions_a,
            actions_b,
            actions_c,
          ] as ActionBundle,
          action_signatures_c: [
            actions_signature_a,
            actions_signature_b,
            actions_signature_c,
          ] as ActionSignatures,
          action_subjects_c: [
            a.toB58String(),
            b.toB58String(),
            c.toB58String(),
          ] as ActionSubjects,
        };
        return data[cid];
      },
    } as any) as IPFS;
    const mock_ctx = ({
      ipfs: mock_ipfs,
      db: {
        peer: {
          get_n_known_peers: async () => 4,
          get_pubkey_by_mid: async (mid: string) => {
            const mid_to_pubkey = {
              [a.toB58String()]: a.pubKey.bytes,
              [b.toB58String()]: b.pubKey.bytes,
              [c.toB58String()]: c.pubKey.bytes,
              [d.toB58String()]: d.pubKey.bytes,
            };
            return mid_to_pubkey[mid];
          },
        },
      },
    } as any) as Context;
    const witnesses: Witnesses = [
      a.toB58String(),
      b.toB58String(),
      c.toB58String(),
      d.toB58String(),
    ];
    const witness_testimony_cids: WitnessTestimonyCIDs = [
      'testimony_a',
      'testimony_b',
      'testimony_c',
      'testimony_c',
    ];
    const witness_signatures: WitnessSignatures = [
      Buffer.from('a'),
      Buffer.from('b'),
      Buffer.from('c'),
      Buffer.from('d'),
    ];
    const intersection_actions = await get_intersection_actions(
      mock_ctx,
      before_prev_block_hash,
      prev_block_hash,
      witnesses,
      witness_testimony_cids,
      witness_signatures,
      0,
    );
    [a.toB58String(), b.toB58String()].forEach((i, idx) => {
      assert.strictEqual(i === intersection_actions.action_subjects[idx], true);
    });
  });
});
